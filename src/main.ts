// エントリポイント。App を #app に取り付ける
import { mount } from 'svelte';
import './styles/app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app がありません');

export default mount(App, { target });
