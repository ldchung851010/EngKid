import assert from 'node:assert/strict';
import test from 'node:test';
import { getSvgForWord } from '../../src/engine/collectibles/vocab-svg-map.ts';
import { airportConfig } from '../../src/scenes/airport/config.ts';
import { beachConfig } from '../../src/scenes/beach/config.ts';
import { farmConfig } from '../../src/scenes/farm/config.ts';
import { homeConfig } from '../../src/scenes/home/config.ts';
import { hospitalConfig } from '../../src/scenes/hospital/config.ts';
import { hotelConfig } from '../../src/scenes/hotel/config.ts';
import { parkConfig } from '../../src/scenes/park/config.ts';
import { restaurantConfig } from '../../src/scenes/restaurant/config.ts';
import { schoolConfig } from '../../src/scenes/school/config.ts';
import { shopConfig } from '../../src/scenes/shop/config.ts';
import { zooConfig } from '../../src/scenes/zoo/config.ts';

test('returns mapped SVG for known words', () => {
  const hamburger = getSvgForWord('hamburger');
  const pizza = getSvgForWord('pizza');

  assert.match(hamburger, /^<svg[\s\S]*<\/svg>$/);
  assert.match(pizza, /^<svg[\s\S]*<\/svg>$/);
  assert.notEqual(hamburger, pizza);
});

test('returns fallback SVG for unknown and empty words', () => {
  assert.match(getSvgForWord('xylophone'), />X<\/text>/);
  assert.match(getSvgForWord(''), />\?<\/text>/);
});

test('returns SVG for all current scene target vocabulary', () => {
  const words = [
    ...airportConfig.targetVocabulary,
    ...beachConfig.targetVocabulary,
    ...farmConfig.targetVocabulary,
    ...homeConfig.targetVocabulary,
    ...hospitalConfig.targetVocabulary,
    ...hotelConfig.targetVocabulary,
    ...parkConfig.targetVocabulary,
    ...restaurantConfig.targetVocabulary,
    ...schoolConfig.targetVocabulary,
    ...shopConfig.targetVocabulary,
    ...zooConfig.targetVocabulary,
  ];

  for (const word of words) {
    const svg = getSvgForWord(word);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.match(svg, /viewBox="0 0 64 64"/);
  }
});
