import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface Settings {
	flomoAPI: string;
}

const DEFAULT_SETTINGS: Settings = {
	flomoAPI: ''
}

export default class ObsidianToFlomo extends Plugin {
	settings: Settings;
	checkResult: boolean;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'send-to-flome-all',
			name: 'Send current content to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.checkResult = this.checkSettings();
				if (this.checkResult) {
					new sendFlomeAPI(this.app, this).sendRequest(editor.getSelection());
					new Notice('The current content has been sent to Flomo');
				}
			}
		});

		this.addCommand({
			id: 'send-to-flome-selected',
			name: 'Send selected content to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.checkResult = this.checkSettings();
				if (this.checkResult) {
					new sendFlomeAPI(this.app, this).sendRequest(editor.getSelection());
					new Notice('The selection has been sent to Flomo');
				}
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

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

class sendFlomeAPI {
	plugin: ObsidianToFlomo;

	constructor(app: App, plugin: ObsidianToFlomo) {
		this.plugin = plugin;
	}

	async sendRequest(text: string){
		const xhr = new XMLHttpRequest();
		xhr.open("POST",this.plugin.settings.flomoAPI);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			"content": text
		}));
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ObsidianToFlomo;

	constructor(app: App, plugin: ObsidianToFlomo) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings'});

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
	}
}
