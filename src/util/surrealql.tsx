import { decodeCbor, encodeCbor } from "surrealdb.js";
import { SurrealQL, Value } from "surrealql.wasm/v1";

/**
 * Validate a query and return an error message if invalid
 */
export function validateQuery(sql: string): string | undefined {
	try {
		SurrealQL.validate(sql);
		return undefined;
	} catch(err: any) {
		return err;
	}
}

/**
 * Validate a record id and return an error message if invalid
 */
export function validateThing(thing: string): string | undefined {
	try {
		SurrealQL.validate_thing(thing);
		return undefined;
	} catch(err: any) {
		return err;
	}
}

/**
 * Validate a where clause and return an error message if invalid
 */
export function validateWhere(where: string): string | undefined {
	try {
		(window as any).SurrealQL = SurrealQL;
		SurrealQL.validate_where(where);
		return undefined;
	} catch(err: any) {
		return err;
	}
}

/**
 * Returns the amount of statements in a query
 */
export function getStatementCount(sql: string): number {
	return SurrealQL.parse(sql).length;
}

/**
 * Format a value structure to a JSON or SQL string
 *
 * @param value The value to format
 * @param type Optionally output as JSON
 * @param pretty Optionally pretty print
 * @returns The formatted value
 */
export function formatValue(value: any, json: boolean = false, pretty: boolean = false) {
	const binary = new Uint8Array(encodeCbor(value));
	const parsed = Value.from_cbor(binary);

	return parsed[json ? 'json' : 'format'](pretty);
}

/**
 * Parse an SQL string back into a value structure
 *
 * @param value The value string
 * @returns The parsed value structure
 */
export function parseValue(value: string) {
	return decodeCbor(Value.from_string(value).to_cbor().buffer);
}

/**
 * Return the the indexes of the live query statements in the given query
 *
 * @param query The query to parse
 * @returns The indexes of the live query statements
 */
export function getLiveQueries(query: string): number[] {
	const tree: any[] = SurrealQL.parse(query);

	return tree.reduce((acc: number[], stmt, idx) => {
		if (stmt.Live) {
			acc.push(idx);
		}

		return acc;
	}, []);
}

/**
 * Format the given query
 *
 * @param query Query string
 * @returns Formatted query
 */
export function formatQuery(query: string) {
	return SurrealQL.format(query, true);
}

/**
 * Extract the kind records from the given kind
 *
 * @param kind The kind to extract records from
 * @returns The extracted records
 */
export function extractKindRecords(kind: string) {
	try {
		const ast = SurrealQL.parse(`DEFINE FIELD dummy ON dummy TYPE ${kind}`);
		const root = ast[0].Define.Field.kind;
		const records = new Set<string>();

		parseKindTree(root, records);

		return [...records.values()];
	} catch {
		return [];
	}
}

function parseKindTree(obj: any, records: Set<string>) {
	if (!obj) return;

	if (obj.Record) {
		for (const record of obj.Record) {
			records.add(record);
		}
	} else if (Array.isArray(obj)) {
		for (const item of obj) {
			parseKindTree(item, records);
		}
	} else {
		for (const key in obj) {
			parseKindTree(obj[key], records);
		}
	}
}