export const FEATURE_FLAGS = {
  recruitment: process.env.NEXT_PUBLIC_ENABLE_RECRUITMENT === "true",
  learning: process.env.NEXT_PUBLIC_ENABLE_LEARNING === "true",
  assets: process.env.NEXT_PUBLIC_ENABLE_ASSETS === "true",
  performance: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE === "true",
  bhxh1Lan: process.env.NEXT_PUBLIC_ENABLE_BHXH_1_LAN === "true",
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

