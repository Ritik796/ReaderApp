import {Dimensions, PixelRatio} from 'react-native';

const {width: SW, height: SH} = Dimensions.get('window');

// Base dimensions (standard Android mid-range — ~360×800)
const BASE_W = 360;
const BASE_H = 800;

/**
 * Scale a size proportionally to screen width.
 * Good for horizontal spacing, icon sizes, border radii.
 */
export function scale(size) {
  return (SW / BASE_W) * size;
}

/**
 * Scale a size proportionally to screen height.
 * Good for vertical spacing and header/section heights.
 */
export function verticalScale(size) {
  return (SH / BASE_H) * size;
}

/**
 * Moderate scale — scales less aggressively than full scale.
 * Best for font sizes and things that shouldn't grow too much on tablets.
 * factor: 0 = no scaling, 1 = full scaling. Default 0.5.
 */
export function ms(size, factor = 0.5) {
  return size + (scale(size) - size) * factor;
}

/**
 * Moderate vertical scale.
 */
export function mvs(size, factor = 0.5) {
  return size + (verticalScale(size) - size) * factor;
}

/**
 * Screen dimensions — re-export for convenience so other files
 * don't need their own Dimensions.get() call.
 */
export {SW, SH};
