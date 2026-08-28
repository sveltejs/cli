import { Option } from 'commander';

export const noDownloadCheckOption = new Option(
	'--no-download-check',
	'skip all download confirmation prompts'
);
export const noInstallOption = new Option('--no-install', 'skip installing dependencies');
