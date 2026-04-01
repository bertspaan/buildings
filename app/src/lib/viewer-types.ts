export type LegendEntry = {
  label: string
  color: string
}

export type BuildingVectorProperties = {
  identificatie?: string
  bouwjaar?: number | string
  status?: string
  gebruiksdoel?: string
}

export type BagPandFeature = {
  id?: string
  properties?: {
    identificatie?: string
    bouwjaar?: number
    status?: string
    gebruiksdoel?: string
    documentdatum?: string
    documentnummer?: string
    geconstateerd?: string
    rdf_seealso?: string
    aantal_verblijfsobjecten?: number
    'verblijfsobject.href'?: string[]
  }
}

export type BagVerblijfsobjectFeature = {
  id?: string
  properties?: {
    identificatie?: string
    hoofdadres_identificatie?: string
    openbare_ruimte_naam?: string
    openbare_ruimte?: string
    huisnummer?: number | string
    huisletter?: string | null
    toevoeging?: string | null
    postcode?: string
    woonplaats_naam?: string
    woonplaats?: string
    status?: string
    gebruiksdoel?: string
    oppervlakte?: number
    pandidentificatie?: string
  }
}

export type SelectedBuildingState = {
  local: BuildingVectorProperties
  location?: {
    lat: number
    lng: number
  }
}
