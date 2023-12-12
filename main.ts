import { App, Editor, MarkdownView, Menu, MenuItem, Notice, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface Settings {
	flomoAPI: string;
	defaultTag: string;
}

const DEFAULT_SETTINGS: Settings = {
	flomoAPI: '',
	defaultTag: '',
}


export default class ObsidianToFlomo extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'send-to-flomo-all',
			name: 'Send current content to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view instanceof MarkdownView && this.checkSettings()) {
					const content = view.getViewData();
					if (content) {
						new FlomoAPI(this.app, this).sendRequest(content, 'The current content has been sent to Flomo');
					} else {
						new Notice('No file is currently open. Please open a file and try again.');
					}
				}
			}
		});

		this.addCommand({
			id: 'send-to-flomo-selected',
			name: 'Send selected content to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view instanceof MarkdownView && this.checkSettings()) {
					const selectedText = editor.getSelection();
					if (selectedText) {
						new FlomoAPI(this.app, this).sendRequest(selectedText, 'The selection has been sent to Flomo');
					} else {
						new Notice('No text selected. Please select some text and try again.');
					}
				}
			}
		});

		this.addCommand({
			id: 'send-to-flomo-selected-each-line',
			name: 'Send selected each line individually to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view instanceof MarkdownView && this.checkSettings()) {
					const selectedText = editor.getSelection();
					if (!selectedText) {
						new Notice('No text selected. Please select some text and try again.');
						return;
					}

					new TagModal(this.app, (tags: string[]) => {
						const trimmedText = selectedText.trim();
						const lines = trimmedText.split('\n');

						for (const line of lines) {
							let content = line.trim();
							if (content.length == 0) continue;

							if (tags) {
								content += "\n";
								for (const tag of tags) {
									if (tag && tag.length > 0) {
										content += "#" + tag + " ";
									}
								}
							}

							new FlomoAPI(this.app, this).sendRequest(content,"The selected lines has been individually sent to Flomo");
						}
					}).open();
				}
			}
		});

		this.addCommand({
			id: 'send-to-flomo-selected-each-paragraph',
			name: 'Send selected each paragraph individually to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view instanceof MarkdownView && this.checkSettings()) {
					const selectedText = editor.getSelection();
					if (!selectedText) {
						new Notice('No text selected. Please select some text and try again.');
						return;
					}

					// const _this = this;
					new TagModal(this.app, (tags: string[]) => {
						const trimmedText = selectedText.trim();
						const paragraphs = trimmedText.split(/\n{2,}/);

						for (const paragraph of paragraphs) {
							let content = paragraph.trim();
							if (content.length == 0) continue;

							if (tags) {
								content += "\n";
								for (const tag of tags) {
									if (tag && tag.length > 0) {
										content += "#" + tag + " ";
									}
								}
							}

							new FlomoAPI(this.app, this).sendRequest(content,"The selected lines has been individually sent to Flomo");
						
						}
					}).open();
				}
			}
		});

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
				if (!editor) {
					return;
				}
				if (editor.getSelection().length === 0) {
					return;
				}

				const selectedText = editor.getSelection();
				let trimText = selectedText;

				if (selectedText.length > 8) {
					trimText = selectedText.substring(0, 3) + "..." + selectedText.substring(selectedText.length - 3, selectedText.length);
				} else {
					trimText = selectedText;
				}

				menu.addItem((item: MenuItem) => {
					item.setTitle('Send "' + trimText + '"' + " to Flomo")
					.onClick(() => new FlomoAPI(this.app, this).sendRequest(selectedText,'The selection has been sent to Flomo'))
				})
			}));


		this.addSettingTab(new FlomoSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	checkSettings() {
		if (this.settings.flomoAPI == '') {
			new Notice('Please set Flomo API first');
			return false;
		}
		return true;
	}
}

class TagModal extends Modal {

	tags: string[] | undefined;
	inputTags: string;

	onSubmit: (tags: string[]) => void;

	constructor(app: App, onSubmit: (tags: string[]) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {  contentEl } = this;

		contentEl.createEl("h1", { text: "Submit Flomo Tags" });

		new Setting(contentEl)
		.setName("Tags")
		.setDesc("Separate tags with commas. e.g. tag1,tag2")
		.addText(text => {
			text.onChange((value) => {
				this.inputTags = value;
			});

			text.inputEl.addEventListener('keypress', (event) => {
				if (event.key === 'Enter') {
					this.tags = this.inputTags.trim().split(",");
					this.onSubmit(this.tags);
					this.close(); 
				}
			});
		});
	

		new Setting(contentEl)
		.addButton((btn) =>btn
			.setButtonText("Submit")
			.setCta()
			.onClick(() => {this.close();
				this.tags = this.inputTags.trim().split(",");
				this.onSubmit(this.tags);
			}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}


class FlomoAPI {
	plugin: ObsidianToFlomo;

	constructor(app: App, plugin: ObsidianToFlomo) {
		this.plugin = plugin;
	}

	async sendRequest(text: string, successMsg?: string) {
		const imageList = this.extractImages(text);
		text = this.removeImageNotations(text);

		const xhr = new XMLHttpRequest();
		xhr.open("POST", this.plugin.settings.flomoAPI);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.timeout = 5000; // Set timeout to 5 seconds
		xhr.send(JSON.stringify({
			"content": text,
			'image_urls': imageList,
		}));
		xhr.onreadystatechange = this.handleResponse.bind(this, xhr, successMsg);
		xhr.onerror = () => {
			new Notice('Network error, please check your connection');
		};
		xhr.ontimeout = () => {
			new Notice('Request timed out, please try again later');
		};
	}

	extractImages(text: string) {
		const regex = /!\[\[(.*?)\]\]/g;
		const matches = text.matchAll(regex);
		const imageList = [];
		for (const match of matches) {
			const image = match[1];
			imageList.push(image);
		}
		return imageList;
	}

	removeImageNotations(text: string) {
		return text.replace(/!\[\[(.*?)\]\]/g, '');
	}

	handleResponse(xhr: XMLHttpRequest, successMsg?: string)  {
		if (xhr.readyState == 4) {
			if (xhr.status == 200) {
				try {
					const json = JSON.parse(xhr.responseText);
					if (json.code == 0) {
						if (successMsg) new Notice(successMsg);
					} else {
						new Notice(json.message + 'please check your settings');
					}
				} catch (e) {
					new Notice('please check your settings');
				}
			} else {
				new Notice('Request failed with status code ' + xhr.status);
			}
		}
	}
}

class FlomoSettingTab extends PluginSettingTab {
	plugin: ObsidianToFlomo;

	constructor(app: App, plugin: ObsidianToFlomo) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Obsidian to Flomo'});

		new Setting(containerEl)
			.setName('Flomo API')
			.setDesc('The plugin does not save your API key, it is only used to send requests.')
			.addText(text => text
				.setPlaceholder('https://flomoapp.com/iwh/xxxxxx/xxxxxx/')
				.setValue(this.plugin.settings.flomoAPI)
				.onChange(async (value) => {
					this.plugin.settings.flomoAPI = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('button', {text: 'Send a test request'}).addEventListener('click', () => {
			new FlomoAPI(this.app, this.plugin).sendRequest('This is a test request', 'The test request has been sent to Flomo');
		});
	}
}
