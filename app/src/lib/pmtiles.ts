import { Protocol } from 'pmtiles'

import type maplibregl from 'maplibre-gl'

let protocol: Protocol | undefined

export function ensurePmtilesProtocol(map: typeof maplibregl) {
  if (protocol) {
    return protocol
  }

  protocol = new Protocol()
  map.addProtocol('pmtiles', protocol.tile)

  return protocol
}
