import * as THREE from 'three';
import type { Seat } from '../core';

/** Seat yaw around world +Y: player south, then counter-clockwise. */
export const SEAT_YAW: Record<Seat, number> = {
  0: 0,
  1: -Math.PI / 2,
  2: Math.PI,
  3: Math.PI / 2,
};

/** Local +Z is the tile face; local −Z is the tile back. */
export const TILE_FACE_LOCAL = new THREE.Vector3(0, 0, 1);
export const TILE_BACK_LOCAL = new THREE.Vector3(0, 0, -1);

/** Named gameplay framing: readable player hand while keeping the full table. */
export const BALANCED_GAMEPLAY_CAMERA = {
  id: 'balanced' as const,
  position: Object.freeze({ x: 0, y: 6.5, z: 12.8 }),
  lookAt: Object.freeze({ x: 0, y: 0.2, z: 0.4 }),
};

/** Upright hand: face toward seat outward (+Z local), back toward table center. */
export function localPlayerHandRotation(): THREE.Quaternion {
  return new THREE.Quaternion();
}

/** Opponent concealed hand uses the same upright local pose; back faces center. */
export function localOpponentConcealedRotation(): THREE.Quaternion {
  return new THREE.Quaternion();
}

/** River / meld: face-up in local space before seat yaw. */
export function localPublicFaceUpRotation(): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
}

/**
 * Compose world pose as seatYaw ⊗ localPose (quaternion multiply).
 * Do not add yaw into Euler.y — that breaks face-up for non-player seats.
 */
export function composeSeatWorldPose(
  seat: Seat,
  localPosition: THREE.Vector3,
  localRotation: THREE.Quaternion,
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const yaw = SEAT_YAW[seat];
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const position = localPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const quaternion = yawQuat.multiply(localRotation.clone());
  return { position, quaternion };
}

export function worldNormalFromLocal(
  localNormal: THREE.Vector3,
  quaternion: THREE.Quaternion,
): THREE.Vector3 {
  return localNormal.clone().applyQuaternion(quaternion);
}

/** Inward (toward table center) unit vector for a seat edge on the XZ plane. */
export function seatInwardHorizontal(seat: Seat): THREE.Vector3 {
  const yaw = SEAT_YAW[seat];
  // Local −Z points toward center before yaw.
  return new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}
