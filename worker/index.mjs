// Worker entry point. The page is served separately (Cloudflare Pages);
// this Worker only answers /api/submit on the same domain.
// The two data files are bundled at deploy time and are not in the repository.
import { createWorker } from "./app.js";
import stations from "../web/data/stations.json";
import distances from "../web/data/distances.json";

export default createWorker({ stations, distances });
