/**
 * ContextVault Central Runtime Environment Configuration
 *
 * Re-exports from EnvironmentManager to maintain backward compatibility
 * across all existing imports.
 */

import {
  EnvironmentManager,
  EnvironmentConfig,
  AppEnvironment,
  DevelopmentEnvironment,
  LocalReleaseEnvironment,
  ProductionEnvironment,
} from './EnvironmentManager';
import { BackendConnectionManager } from '../services/BackendConnectionManager';

export type { EnvironmentConfig, AppEnvironment };
export {
  EnvironmentManager,
  BackendConnectionManager,
  DevelopmentEnvironment,
  LocalReleaseEnvironment,
  ProductionEnvironment,
};

export const ENV: EnvironmentConfig = EnvironmentManager.getConfig();
