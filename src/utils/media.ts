import * as ImagePicker from "expo-image-picker";
import type { NativeFile } from "@/lib/api";

interface PickImageOptions {
  // Recorte com proporção fixa: bom para thumbnail de catálogo, ruim para
  // documento (nota/recibo), onde a foto inteira precisa ser preservada.
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

// Abre câmera ou galeria e devolve o arquivo escolhido (ou null se cancelou).
export async function pickImage(
  source: "camera" | "gallery",
  prefix: string,
  options?: PickImageOptions
): Promise<NativeFile | null> {
  const allowsEditing = options?.allowsEditing ?? true;
  const quality = options?.quality ?? 0.7;
  // O `aspect` só faz sentido quando há recorte; para documento não enviamos,
  // assim a imagem chega completa.
  const aspect = allowsEditing ? options?.aspect ?? [4, 3] : undefined;

  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Permissão de câmera negada.");
    result = await ImagePicker.launchCameraAsync({ quality, allowsEditing, aspect });
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Permissão de fotos negada.");
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality, allowsEditing, aspect });
  }

  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || `${prefix}-${Date.now()}.jpg`,
    type: asset.mimeType || "image/jpeg"
  };
}
