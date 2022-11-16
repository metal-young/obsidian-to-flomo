import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

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
					new sendFlomeAPI(this.app, this).sendRequest(editor.getSelection(),'The current content has been sent to Flomo');
				}
			}
		});

		this.addCommand({
			id: 'send-to-flome-selected',
			name: 'Send selected content to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.checkResult = this.checkSettings();
				if (this.checkResult) {
					new sendFlomeAPI(this.app, this).sendRequest(editor.getSelection(),'The selection has been sent to Flomo');
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

	async sendRequest(text: string, successMsg: string) {
		const xhr = new XMLHttpRequest();
		xhr.open("POST",this.plugin.settings.flomoAPI);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			"content": text
		}));
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4 && xhr.status == 200) {
				console.log(xhr.responseText);
				//能不能转化成json格式
				try {
					const json = JSON.parse(xhr.responseText);
					console.log(json);
					//json里的code如果是0就返回true，如果不是0就提示失败，如果是-1就返回json里的message
					if (json.code == 0) {
						new Notice(successMsg);
					}
					else if (json.code == -1) {
						new Notice(json.message + 'please check your settings');
					}
					else {
						new Notice('please check your settings');
					}
				}
				catch (e) {
					new Notice('please check your settings');
				}
			}
		}
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

		containerEl.createEl('button', {text: 'Send a test request'}).addEventListener('click', () => {
			new sendFlomeAPI(this.app, this.plugin).sendRequest('This is a test request', 'The test request has been sent to Flomo');
		}
		);
	}
}
