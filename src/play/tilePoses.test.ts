import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Seat } from '../core';
import {
  BALANCED_GAMEPLAY_CAMERA,
  composeSeatWorldPose,
  localOpponentConcealedRotation,
  localPublicFaceUpRotation,
  seatInwardHorizontal,
  TILE_BACK_LOCAL,
  TILE_FACE_LOCAL,
  worldNormalFromLocal,
} from './tilePoses';

const SEATS: Seat[] = [0, 1, 2, 3];

describe('composeSeatWorldPose', () => {
  it('lays river/meld faces upward for every seat after world composition', () => {
    const local = new THREE.Vector3(0, 0.21, 1.35);
    for (const seat of SEATS) {
      const { quaternion } = composeSeatWorldPose(seat, local, localPublicFaceUpRotation());
      const face = worldNormalFromLocal(TILE_FACE_LOCAL, quaternion);
      expect(face.y).toBeGreaterThan(0.99);
      expect(Math.abs(face.x)).toBeLessThan(0.02);
      expect(Math.abs(face.z)).toBeLessThan(0.02);
    }
  });

  it('keeps each opponent inward surface as the tile back without needing tile codes', () => {
    const local = new THREE.Vector3(0, 0.23, 4.05);
    for (const seat of SEATS.filter((s) => s !== 0)) {
      const { quaternion } = composeSeatWorldPose(seat, local, localOpponentConcealedRotation());
      const back = worldNormalFromLocal(TILE_BACK_LOCAL, quaternion);
      const inward = seatInwardHorizontal(seat);
      expect(back.dot(inward)).toBeGreaterThan(0.99);
      // Face points outward — never toward the table center / player.
      const face = worldNormalFromLocal(TILE_FACE_LOCAL, quaternion);
      expect(face.dot(inward)).toBeLessThan(-0.99);
    }
  });

  it('does not treat Euler.y += yaw as a valid composition for face-up tiles', () => {
    const localRot = new THREE.Euler(-Math.PI / 2, 0, 0);
    const yaw = Math.PI; // opposite seat
    const bad = new THREE.Euler(localRot.x, localRot.y + yaw, localRot.z);
    const badFace = TILE_FACE_LOCAL.clone().applyEuler(bad);
    expect(badFace.y).toBeLessThan(0); // old bug: face into the table

    const { quaternion } = composeSeatWorldPose(2, new THREE.Vector3(), localPublicFaceUpRotation());
    const goodFace = worldNormalFromLocal(TILE_FACE_LOCAL, quaternion);
    expect(goodFace.y).toBeGreaterThan(0.99);
  });
});

describe('BALANCED_GAMEPLAY_CAMERA', () => {
  it('names the balanced profile and lowers pitch versus the legacy high camera', () => {
    expect(BALANCED_GAMEPLAY_CAMERA.id).toBe('balanced');
    const legacy = new THREE.Vector3(0, 9.2, 11.5);
    const look = new THREE.Vector3(
      BALANCED_GAMEPLAY_CAMERA.lookAt.x,
      BALANCED_GAMEPLAY_CAMERA.lookAt.y,
      BALANCED_GAMEPLAY_CAMERA.lookAt.z,
    );
    const balanced = new THREE.Vector3(
      BALANCED_GAMEPLAY_CAMERA.position.x,
      BALANCED_GAMEPLAY_CAMERA.position.y,
      BALANCED_GAMEPLAY_CAMERA.position.z,
    );
    const legacyDir = look.clone().sub(legacy).normalize();
    const balancedDir = look.clone().sub(balanced).normalize();
    const legacyPitch = Math.asin(-legacyDir.y);
    const balancedPitch = Math.asin(-balancedDir.y);
    expect(balancedPitch).toBeLessThan(legacyPitch - 0.1);
    expect(balanced.z).toBeGreaterThan(legacy.z - 0.01);
  });
});
