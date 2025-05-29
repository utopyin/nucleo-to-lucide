import { Database } from "bun:sqlite";
import { deleteAsync } from "del";
import { homedir } from "node:os";

const ICONS_DIR = `${homedir()}/Library/Application Support/Nucleo/icons`;

const db = new Database(`${ICONS_DIR}/data.sqlite3`);

class Icon {
	id: number;
	pathName: string;
	name: string;
	set_id: number;
	tags: string[];
	title: string;
	grid: 12 | 18;
	categories: Set<string>;

	// biome-ignore lint/suspicious/noExplicitAny: coming from sqlite
	constructor(data: any) {
		this.id = data.id;
		this.name = data.name;
		this.pathName = `${data.name}${data.grid === 12 ? "-small" : ""}`;
		this.set_id = data.set_id;
		this.tags = data.nucleo_tags.split(",");
		this.title = data.title;
		this.grid = data.grid;
		this.categories = new Set(
			data.title.split("/").map((c: string) => c.toLocaleLowerCase()),
		);
	}
}

const result = db
	.query(
		`select icons.id, icons.name, icons.set_id, icons.nucleo_tags, icons.klass, icons.grid, sets.title from icons left join sets on group_id=1 WHERE icons.set_id = sets.id and icons.klass == "glyph";`,
	)
	.all();

const icons = result.map((icon) => new Icon(icon));

// deduplicate icons by name and grid and merge categories
const iconsMap = new Map<string, Icon>();
for (const icon of icons) {
	const existingIcon = iconsMap.get(icon.pathName);
	if (existingIcon) {
		for (const category of icon.categories) {
			existingIcon.categories.add(category);
		}
		continue;
	}

	iconsMap.set(icon.pathName, icon);
}

// clear icons directory
await deleteAsync(["./icons/*", "!./icons/.gitkeep"], {
	force: true,
});

for (const icon of iconsMap.values()) {
	const svgSourceFile = Bun.file(
		`${ICONS_DIR}/sets/${icon.set_id}/${icon.id}.svg`,
	);

	const destinationPath = `./icons/${icon.pathName}`;
	const svgDestinationFile = Bun.file(`${destinationPath}.svg`);
	const jsonDestinationFile = Bun.file(`${destinationPath}.json`);

	svgDestinationFile.write(svgSourceFile);
	jsonDestinationFile.write(
		JSON.stringify(
			{
				$schema: "../icon.schema.json",
				contributors: ["claudia-romano", "sebastiano-guerriero", "utopyin"],
				tags: icon.tags,
				categories: Array.from(icon.categories),
				aliases: [],
			},
			null,
			2,
		),
	);
}
