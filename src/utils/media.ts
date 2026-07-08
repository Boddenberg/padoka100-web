import * as ImagePicker from "expo-image-picker";
import type { NativeFile } from "@/lib/api";

// Abre câmera ou galeria e devolve o arquivo escolhido (ou null se cancelou).
export async function pickImage(source: "camera" | "gallery", prefix: string): Promise<NativeFile | null> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Permissão de câmera negada.");
    result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Permissão de fotos negada.");
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3]
    });
  }

  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || `${prefix}-${Date.now()}.jpg`,
    type: asset.mimeType || "image/jpeg"
  };
}
