// Post-processes `boneyard-js build` captures (run by `npm run bones`):
//  - caps each skeleton at one screen, since a loading state never needs the 100th log row
//    and the captures ship in the client bundle;
//  - turns table cells, which boneyard captures edge to edge, into text-sized bars so a
//    loading table reads as rows of text instead of a solid slab.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const MAX_HEIGHT = 960
const CELL_PADDING = 12
const TEXT_HEIGHT = 12
const dir = new URL("../src/bones/", import.meta.url).pathname

for (const file of readdirSync(dir).filter((name) => name.endsWith(".bones.json"))) {
  const path = join(dir, file)
  const capture = JSON.parse(readFileSync(path, "utf8"))
  for (const layout of Object.values(capture.breakpoints ?? { single: capture })) {
    // Bones are [x%, y, w%, h, radius, container?]. Boneyard gives table nodes, and only
    // them, a radius of 0; containers are not drawn, so only leaf cells need reshaping.
    layout.bones = layout.bones.map((bone) => {
      const [x, y, w, h, r, container] = bone
      if (r !== 0 || container || h <= TEXT_HEIGHT + 4) return bone
      const pad = (CELL_PADDING / layout.width) * 100
      const inner = Math.max(w - 2 * pad, w / 2)
      return [+(x + pad).toFixed(4), Math.round(y + (h - TEXT_HEIGHT) / 2), +(inner * 0.8).toFixed(4), TEXT_HEIGHT, 4]
    })
    if (layout.height > MAX_HEIGHT) {
      layout.bones = layout.bones
        .filter((bone) => bone[1] < MAX_HEIGHT)
        .map((bone) => (bone[1] + bone[3] > MAX_HEIGHT ? [bone[0], bone[1], bone[2], MAX_HEIGHT - bone[1], ...bone.slice(4)] : bone))
      layout.height = MAX_HEIGHT
    }
  }
  writeFileSync(path, JSON.stringify(capture))
}
