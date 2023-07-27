import { save } from "@tauri-apps/api/dialog";
import { writeTextFile } from "@tauri-apps/api/fs";
import { adapter } from "~/adapter";
import { actions, store } from "~/store";
import { TableDefinition } from "~/typings";

/**
 * Fetch information about a table schema
 * 
 * @param table The table to query
 * @returns Schema information
 */
export async function fetchDatabaseSchema() {
	const tables = await adapter.fetchSchema();

	store.dispatch(actions.setDatabaseSchema(tables));

	return tables;
}

/**
 * Returns true if the table is an edge table
 * 
 * @param table The table to check
 * @returns True if the table is an edge table
 */
export function extractEdgeRecords(table: TableDefinition): [boolean, string[], string[]] {
	let hasIn = false;
	let hasOut = false;
	let inRecords: string[] = [];
	let outRecords: string[] = [];

	for (const f of table.fields) {
		if (f.name == 'in') {
			inRecords = f.kindTables;
			hasIn = true;
		} else if (f.name == 'out') {
			outRecords = f.kindTables;
			hasOut = true;
		}
	}

	return [hasIn && hasOut, inRecords, outRecords];
}

/**
 * Returns true if the table is an edge table
 * 
 * @param table The table to check
 * @returns True if the table is an edge table
 */
export function isEdgeTable(table: TableDefinition) {
	return extractEdgeRecords(table)[0];
}

/**
 * Export the database schema and save it to a file
 */
export async function saveSchemaExport() {
	const surreal = adapter.getActiveSurreal();
	const dbResponse = await surreal.query('INFO FOR DB');
	const dbTables = Object.entries(dbResponse[0].result.tb);
	const output: string[] = [
		'-- Export generated by Surrealist on ' + new Date().toISOString(),
	];

	function pushSection(title: string) {
		output.push('', '-- ------------------------------', '-- ' + title, '-- ------------------------------', '');
	}

	pushSection('OPTION');

	output.push('OPTION IMPORT;');

	for (const [tableName, definition] of dbTables) {
		pushSection('TABLE: ' + tableName);

		output.push(`${definition};`);

		const tbResponse = await surreal.query(`INFO FOR TABLE ${tableName}`);
		const tbInfo = tbResponse[0].result;

		const tbFields = Object.values(tbInfo.fd);
		const tbIndexes = Object.values(tbInfo.ix);
		const tbEvents = Object.values(tbInfo.ev);

		if (tbFields.length > 0) {
			output.push('');

			for (const fieldDef of tbFields) {
				output.push(`${fieldDef};`);
			}
		}

		if (tbIndexes.length > 0) {
			output.push('');

			for (const indexDef of tbIndexes) {
				output.push(`${indexDef};`);
			}
		}

		if (tbEvents.length > 0) {
			output.push('');

			for (const eventDef of tbEvents) {
				output.push(`${eventDef};`);
			}
		}
	}

	const filePath = await save({
		title: 'Save database schema',
		defaultPath: 'schema.surql',
		filters: [{
			name: 'SurrealDB Schema',
			extensions: ['surql', 'sql', 'surrealql']
		}]
	});

	if (!filePath) {
		return;
	}

	await writeTextFile(filePath, output.join('\n'));
}