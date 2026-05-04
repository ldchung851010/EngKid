import * as THREE from 'three';

/** Isometric follow camera with click-to-move (mouse + touch) */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // Player group that moves on the ground plane
  private playerGroup: THREE.Group;

  // Camera follow
  private cameraOffset = new THREE.Vector3(15, 15, 15);
  private cameraLerpSpeed = 4;

  // Movement
  private moveTarget: THREE.Vector3 | null = null;
  private moveSpeed = 5;
  private canOccupy: ((position: THREE.Vector3) => boolean) | null = null;

  // Pathfinding
  private waypointPath: THREE.Vector3[] | null = null;
  private waypointIndex = 0;
  private pathfinder: ((start: THREE.Vector3, end: THREE.Vector3) => THREE.Vector3[] | null) | null = null;

  // Raycaster for click-to-move
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1); // y=1.0 floor surface
  private pointerStart = new THREE.Vector2();
  private isDragging = false;

  // Clickable objects for interaction
  private clickableObjects: THREE.Object3D[] = [];
  private onClickCallback: ((hitObject: THREE.Object3D) => void) | null = null;
  private onGroundClickCallback: ((worldPos: THREE.Vector3) => void) | null = null;

  // Bound handlers
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    playerGroup: THREE.Group,
    domElement: HTMLElement,
  ) {
    this.camera = camera;
    this.playerGroup = playerGroup;
    this.domElement = domElement;

    // Touch-action none for mobile
    this.domElement.style.touchAction = 'none';

    this.onPointerDown = (e) => this.handlePointerDown(e);
    this.onPointerMove = (e) => this.handlePointerMove(e);
    this.onPointerUp = (e) => this.handlePointerUp(e);

    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
  }

  update(delta: number): void {
    // Move player toward target
    if (this.moveTarget) {
      const pos = this.playerGroup.position;
      const dx = this.moveTarget.x - pos.x;
      const dz = this.moveTarget.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.001) {
        // Snap to exact target and advance
        pos.x = this.moveTarget.x;
        pos.z = this.moveTarget.z;
        if (this.waypointPath && this.waypointIndex < this.waypointPath.length - 1) {
          this.waypointIndex++;
          this.moveTarget = this.waypointPath[this.waypointIndex].clone();
          this.moveTarget.y = 0;
        } else {
          this.moveTarget = null;
          this.waypointPath = null;
        }
      } else {
        const step = this.moveSpeed * delta;
        const moveX = (dx / dist) * Math.min(step, dist);
        const moveZ = (dz / dist) * Math.min(step, dist);

        const nextPos = pos.clone();
        nextPos.x += moveX;
        nextPos.z += moveZ;

        if (this.canOccupy) {
          // Try full movement, then X-only, then Z-only
          if (this.canOccupy(nextPos)) {
            pos.x = nextPos.x;
            pos.z = nextPos.z;
          } else {
            const nextX = pos.clone();
            nextX.x += moveX;
            if (this.canOccupy(nextX)) {
              pos.x = nextX.x;
            }
            const nextZ = pos.clone();
            nextZ.z += moveZ;
            if (this.canOccupy(nextZ)) {
              pos.z = nextZ.z;
            }
          }
        } else {
          pos.x = nextPos.x;
          pos.z = nextPos.z;
        }

        // Face movement direction
        const angle = Math.atan2(dx, dz);
        this.playerGroup.rotation.y = angle;
      }
    }

    // Smooth follow camera
    const targetCamPos = new THREE.Vector3()
      .copy(this.playerGroup.position)
      .add(this.cameraOffset);
    this.camera.position.lerp(targetCamPos, this.cameraLerpSpeed * delta);
    this.camera.lookAt(this.playerGroup.position);
  }

  setCollisionTester(
    canOccupy: ((position: THREE.Vector3) => boolean) | null,
  ): void {
    this.canOccupy = canOccupy;
  }

  get isMoving(): boolean {
    return this.moveTarget !== null;
  }

  getPlayerPosition(): THREE.Vector3 {
    return this.playerGroup.position;
  }

  setMoveTarget(worldPos: THREE.Vector3, path?: THREE.Vector3[]): void {
    if (path && path.length > 1) {
      this.waypointPath = path;
      this.waypointIndex = 1;
      this.moveTarget = path[1].clone();
      this.moveTarget.y = 0;
    } else {
      this.waypointPath = null;
      this.waypointIndex = 0;
      this.moveTarget = worldPos.clone();
      this.moveTarget.y = 0;
    }
  }

  stopMoving(): void {
    this.moveTarget = null;
    this.waypointPath = null;
    this.waypointIndex = 0;
  }

  /** Register objects that can be clicked for interaction */
  setClickableObjects(objects: THREE.Object3D[]): void {
    this.clickableObjects = objects;
  }

  /** Add a single clickable object (e.g. collectible, portal) */
  addClickableObject(obj: THREE.Object3D): void {
    this.clickableObjects.push(obj);
  }

  /** Get all registered clickable objects */
  getClickableObjects(): THREE.Object3D[] {
    return this.clickableObjects;
  }

  /** Raycast at screen position, return hit interactive object or null */
  hitTestAtScreen(screenX: number, screenY: number): THREE.Object3D | null {
    return this.hitTestObjects(screenX, screenY);
  }

  setOnObjectClick(callback: (hitObject: THREE.Object3D) => void): void {
    this.onClickCallback = callback;
  }

  setOnGroundClick(callback: (worldPos: THREE.Vector3) => void): void {
    this.onGroundClickCallback = callback;
  }

  /** Inject pathfinder function for click-to-move pathfinding */
  setPathfinder(fn: ((start: THREE.Vector3, end: THREE.Vector3) => THREE.Vector3[] | null) | null): void {
    this.pathfinder = fn;
  }

  /** Raycast against clickable objects. Returns hit object or null. */
  private hitTestObjects(screenX: number, screenY: number): THREE.Object3D | null {
    const rect = this.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickableObjects, true);
    if (hits.length > 0) {
      // Walk up to find the group with userData.npcId, userData.portalPart, or userData.collectibleWord
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj) {
        if (
          obj.userData.npcId ||
          obj.userData.portalPart ||
          obj.userData.isPortal ||
          obj.userData.collectibleWord
        ) {
          return obj;
        }
        obj = obj.parent;
      }
      // Fallback: return the hit object's top-level parent group
      let top = hits[0].object;
      while (top.parent && top.parent !== this.playerGroup && top.parent.type !== 'Scene') {
        top = top.parent;
      }
      return top;
    }
    return null;
  }

  /** Raycast to ground plane. Returns world position or null. */
  private hitTestGround(screenX: number, screenY: number): THREE.Vector3 | null {
    const rect = this.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, target)) {
      return target;
    }
    return null;
  }

  private handlePointerDown(e: PointerEvent): void {
    this.pointerStart.set(e.clientX, e.clientY);
    this.isDragging = false;
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.buttons === 0) return;
    const dx = e.clientX - this.pointerStart.x;
    const dy = e.clientY - this.pointerStart.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      this.isDragging = true;
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.isDragging) return;
    // Only respond to primary button / touch
    if (e.button !== undefined && e.button !== 0) return;

    // First: try clicking on interactive objects
    const hitObj = this.hitTestObjects(e.clientX, e.clientY);
    if (hitObj && this.onClickCallback) {
      this.onClickCallback(hitObj);
      return;
    }

    // Fallback: click on ground to move
    const groundPos = this.hitTestGround(e.clientX, e.clientY);
    if (groundPos) {
      if (this.onGroundClickCallback) {
        this.onGroundClickCallback(groundPos);
      }
      if (this.pathfinder) {
        const path = this.pathfinder(this.playerGroup.position, groundPos);
        if (path) {
          this.setMoveTarget(groundPos, path);
        } else {
          this.setMoveTarget(groundPos);
        }
      } else {
        this.setMoveTarget(groundPos);
      }
    }
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
  }
}
