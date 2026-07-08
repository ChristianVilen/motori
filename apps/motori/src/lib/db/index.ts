import { createDb } from "@motori/db";
import type { Kysely } from "kysely";
import type { Database } from "./schema";

export const db: Kysely<Database> = await createDb<Database>();
