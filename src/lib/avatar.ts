// [OWNER: UI] Pick a profile picture from the photo library and shrink it so it can live right on the
// user's Firestore doc (no Storage bucket needed): square crop, 256 px, JPEG, as a data URI (~20-40 KB).
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const AVATAR_PX = 256;

export type PickResult = { photo: string } | { error: 'denied' | 'failed' } | null; // null = cancelled

export async function pickAvatar(): Promise<PickResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { error: 'denied' };
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // lets the user crop to a square
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    const out = await ImageManipulator.manipulateAsync(
      res.assets[0].uri,
      [{ resize: { width: AVATAR_PX, height: AVATAR_PX } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!out.base64) return { error: 'failed' };
    return { photo: `data:image/jpeg;base64,${out.base64}` };
  } catch (e) {
    console.warn('pickAvatar failed:', e instanceof Error ? e.message : e);
    return { error: 'failed' };
  }
}
