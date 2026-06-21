// Одно лицо на игрока, стабильное между лобби и игрой (детерминированно по id).
const FACES = ['🙂', '😎', '🤩', '😄', '😁', '🙃', '😊', '😌', '🥳', '😀']

export function faceFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return FACES[h % FACES.length]
}
