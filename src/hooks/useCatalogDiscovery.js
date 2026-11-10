import { useSyncExternalStore } from "react";
import {
  readDiscovery,
  subscribeDiscovery,
} from "@/services/games/catalogDiscoveryStore";
export default function useCatalogDiscovery() {
  return useSyncExternalStore(subscribeDiscovery, readDiscovery);
}
