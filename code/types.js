
class Types {

  static KIND_UNIT = 0;
  static KIND_BUILDING = 1;
  static KIND_MINERAL_FIELD = 2;
  static KIND_VESPENE_GEYSER = 3;

  abilities = new Map();
  infos = new Map();
  products = new Map();
  units = new Map();

  ability(id) {
    return this.abilities.get(id) || "";
  }

  info(id) {
    return this.infos.get(id) || {};
  }

  product(id) {
    return this.products.get(id);
  }

  unit(id) {
    return this.units.get(id) || { kind: -1, name: id, alias: null };
  }

  read(data) {
    if (!data) return;

    if (data.abilities) {
      for (const ability of data.abilities) {
        if (ability.available && ability.linkName) {
          this.abilities.set(ability.abilityId, ability.linkName);
        }
        if (ability.available && ability.buttonName && ALIASES[ability.buttonName]) {
          this.products.set(ability.abilityId, ALIASES[ability.buttonName]);
        }
      }
    }

    if (data.units) {
      for (const unit of data.units) {
        if (unit.unitId && unit.name) {
          const kind = getKind(unit);
          const alias = (unit.race && ((kind === Types.KIND_UNIT) || (kind === Types.KIND_BUILDING))) ? ALIASES[unit.name] : null;

          const type = {
            kind: kind,
            name: unit.name,
            alias: alias,
          };

          this.infos.set(unit.unitId, unit);
          this.units.set(unit.unitId, type);
        }
      }
    }
  }
}

function getKind(unit) {
  if (unit.name.indexOf("MineralField") >= 0) {
    return Types.KIND_MINERAL_FIELD;
  } else if (unit.name.indexOf("Geyser") >= 0) {
    return Types.KIND_VESPENE_GEYSER;
  } else if (unit.attributes && (unit.attributes.indexOf(8) >= 0)) {
    return Types.KIND_BUILDING;
  } else {
    return Types.KIND_UNIT;
  }
}

const ALIASES = {
  "Adept": "Adept",
  "AdeptPhaseShift": "Adept",
  "Archon": "Archon",
  "Armory": "Armory",
  "Assimilator": "Assimilator",
  "AssimilatorRich": "Assimilator",
  "AutoTurret": "AutoTurret",
  "Baneling": "Baneling",
  "BanelingBurrowed": "Baneling",
  "BanelingNest": "BanelingNest",
  "Banshee": "Banshee",
  "Barracks": "Barracks",
  "BarracksFlying": "Barracks",
  "BarracksReactor": "BarracksReactor",
  "BarracksTechLab": "BarracksTechLab",
  "Battlecruiser": "Battlecruiser",
  "Broodling": "Broodling",
  "BroodLord": "BroodLord",
  "Bunker": "Bunker",
  "Carrier": "Carrier",
  "Changeling": "Changeling",
  "ChangelingMarine": "Changeling",
  "ChangelingMarineShield": "Changeling",
  "ChangelingZealot": "Changeling",
  "ChangelingZergling": "Changeling",
  "ChangelingZerglingWings": "Changeling",
  "Colossus": "Colossus",
  "CommandCenter": "CommandCenter",
  "CommandCenterFlying": "CommandCenter",
  "Corruptor": "Corruptor",
  "CreepTumor": "CreepTumor",
  "CreepTumorBurrowed": "CreepTumor",
  "CreepTumorQueen": "CreepTumorQueen",
  "CyberneticsCore": "CyberneticsCore",
  "Cyclone": "Cyclone",
  "DarkShrine": "DarkShrine",
  "DarkTemplar": "DarkTemplar",
  "Disruptor": "Disruptor",
  "Drone": "Drone",
  "DroneBurrowed": "Drone",
  "EngineeringBay": "EngineeringBay",
  "EvolutionChamber": "EvolutionChamber",
  "Extractor": "Extractor",
  "ExtractorRich": "Extractor",
  "Factory": "Factory",
  "FactoryFlying": "Factory",
  "FactoryReactor": "FactoryReactor",
  "FactoryTechLab": "FactoryTechLab",
  "FleetBeacon": "FleetBeacon",
  "Forge": "Forge",
  "FusionCore": "FusionCore",
  "Gateway": "Gateway",
  "Ghost": "Ghost",
  "GhostAlternate": "Ghost",
  "GhostNova": "Ghost",
  "GhostAcademy": "GhostAcademy",
  "GreaterSpire": "GreaterSpire",
  "Hatchery": "Hatchery",
  "Hellbat": "Hellbat",
  "Hellion": "Hellion",
  "HellionTank": "Hellbat",
  "HighTemplar": "HighTemplar",
  "Hive": "Hive",
  "Hydralisk": "Hydralisk",
  "HydraliskBurrowed": "Hydralisk",
  "HydraliskDen": "HydraliskDen",
  "Immortal": "Immortal",
  "InfestationPit": "InfestationPit",
  "InfestedTerran": "InfestedTerran",
  "Infestor": "Infestor",
  "InfestorBurrowed": "Infestor",
  "Lair": "Lair",
  "Larva": "Larva",
  "Liberator": "Liberator",
  "LiberatorAG": "LiberatorAG",
  "Lurker": "Lurker",
  "LurkerMP": "Lurker",
  "LurkerMPBurrowed": "Lurker",
  "LurkerDen": "LurkerDen",
  "LurkerDenMP": "LurkerDen",
  "Marauder": "Marauder",
  "Marine": "Marine",
  "Medivac": "Medivac",
  "MissileTurret": "MissileTurret",
  "Mothership": "Mothership",
  "MothershipCore": "MothershipCore",
  "MULE": "MULE",
  "Mutalisk": "Mutalisk",
  "Nexus": "Nexus",
  "NydusCanal": "NydusWorm",
  "NydusNetwork": "NydusNetwork",
  "NydusWorm": "NydusWorm",
  "Observer": "Observer",
  "ObserverSiegeMode": "Observer",
  "Oracle": "Oracle",
  "OrbitalCommand": "OrbitalCommand",
  "OrbitalCommandFlying": "OrbitalCommand",
  "Overlord": "Overlord",
  "OverlordTransport": "Overlord",
  "Overseer": "Overseer",
  "OverseerSiegeMode": "Overseer",
  "Phoenix": "Phoenix",
  "PhotonCannon": "PhotonCannon",
  "PlanetaryFortress": "PlanetaryFortress",
  "PointDefenseDrone": "PointDefenseDrone",
  "Probe": "Probe",
  "Pylon": "Pylon",
  "PylonOvercharged": "Pylon",
  "Queen": "Queen",
  "QueenBurrowed": "Queen",
  "QueenMP": "Queen",
  "Ravager": "Ravager",
  "RavagerBurrowed": "Ravager",
  "Raven": "Raven",
  "Reactor": "Reactor",
  "Reaper": "Reaper",
  "ReaperPlaceholder": "Reaper",
  "Refinery": "Refinery",
  "RefineryRich": "Refinery",
  "RenegadeMissileTurret": "MissileTurret",
  "Roach": "Roach",
  "RoachBurrowed": "Roach",
  "RoachWarren": "RoachWarren",
  "RoboticsBay": "RoboticsBay",
  "RoboticsFacility": "RoboticsFacility",
  "SCV": "SCV",
  "SensorTower": "SensorTower",
  "Sentry": "Sentry",
  "ShieldBattery": "ShieldBattery",
  "SiegeTank": "SiegeTank",
  "SiegeTankSieged": "SiegeTankSieged",
  "SpawningPool": "SpawningPool",
  "SpineCrawler": "SpineCrawler",
  "SpineCrawlerUprooted": "SpineCrawler",
  "Spire": "Spire",
  "SporeCrawler": "SporeCrawler",
  "SporeCrawlerUprooted": "SporeCrawler",
  "Stalker": "Stalker",
  "Stargate": "Stargate",
  "Starport": "Starport",
  "StarportFlying": "Starport",
  "StarportReactor": "StarportReactor",
  "StarportTechLab": "StarportTechLab",
  "StasisWard": "StasisWard",
  "SupplyDepot": "SupplyDepot",
  "SupplyDepotLowered": "SupplyDepot",
  "SwarmHost": "SwarmHost",
  "SwarmHostBurrowedMP": "SwarmHost",
  "SwarmHostMP": "SwarmHost",
  "TechLab": "TechLab",
  "Tempest": "Tempest",
  "TemplarArchive": "TemplarArchives",
  "TemplarArchives": "TemplarArchives",
  "Thor": "Thor",
  "ThorAP": "Thor",
  "TwilightCouncil": "TwilightCouncil",
  "Ultralisk": "Ultralisk",
  "UltraliskBurrowed": "Ultralisk",
  "UltraliskCavern": "UltraliskCavern",
  "Viking": "Viking",
  "VikingAssault": "VikingAssault",
  "VikingFighter": "VikingFighter",
  "Viper": "Viper",
  "VoidRay": "VoidRay",
  "WarpGate": "WarpGate",
  "WarpPrism": "WarpPrism",
  "WarpPrismPhasing": "WarpPrism",
  "WidowMine": "WidowMine",
  "WidowMineBurrowed": "WidowMine",
  "Zealot": "Zealot",
  "Zergling": "Zergling",
  "ZerglingBurrowed": "Zergling",
};

module.exports = new Types();
