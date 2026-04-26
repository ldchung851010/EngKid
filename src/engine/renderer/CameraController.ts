import * as THREE from 'three';

/** First-person camera controller with WASD + mouse look */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private enabled = true;

  // Movement state
  private keys = new Set<string>();
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Mouse state
  private isPointerLocked = false;

  // Config
  private moveSpeed = 8;
  private lookSensitivity = 0.002;

  // Bound handlers (for cleanup)
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onClick: () => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.euler.setFromQuaternion(camera.quaternion);

    this.onKeyDown = (e) => this.keys.add(e.code);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => this.handleMouseMove(e);
    this.onClick = () => this.domElement.requestPointerLock();

    this.domElement.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener(
      'pointerlockchange',
      () => {
        this.isPointerLocked = document.pointerLockElement === this.domElement;
      }
    );
  }

  update(delta: number): void {
    if (!this.enabled || !this.isPointerLocked) return;

    // Deceleration
    this.velocity.x *= 0.9;
    this.velocity.z *= 0.9;

    // WASD input
    this.direction.set(0, 0, 0);
    if (this.keys.has('KeyW')) this.direction.z -= 1;
    if (this.keys.has('KeyS')) this.direction.z += 1;
    if (this.keys.has('KeyA')) this.direction.x -= 1;
    if (this.keys.has('KeyD')) this.direction.x += 1;

    if (this.direction.length() > 0) {
      this.direction.normalize();
      // Rotate direction by camera yaw
      const speed = this.moveSpeed * delta;
      this.velocity.x += this.direction.x * speed * 0.15;
      this.velocity.z += this.direction.z * speed * 0.15;
    }

    // Apply yaw rotation to velocity
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.euler.y, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.euler.y, 0));

    this.camera.position.add(
      forward.multiplyScalar(this.velocity.z).add(right.multiplyScalar(this.velocity.x))
    );
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isPointerLocked) return;
    this.euler.y -= e.movementX * this.lookSensitivity;
    this.euler.x -= e.movementY * this.lookSensitivity;
    this.euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  dispose(): void {
    this.domElement.removeEventListener('click', this.onClick);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }
}
