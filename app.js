(() => {
  'use strict';

  const VERSION = '8.2.0';
  const STORAGE_KEY = 'puro_doce_gourmet_v8_2_0';
  const PRICE_SINGLE = 8;
  const PRICE_BULK = 7.5;
  const HISTORY_LIMIT = 300;
  const FLAVORS = ['ninho', 'tradicional', 'misto'];
  const PAYMENT_TYPES = ['pix', 'dinheiro'];

  const DEFAULT_STATE = Object.freeze({
    estoque: { ninho: 0, tradicional: 0, misto: 0 },
    financeiro: { pix: 0, dinheiro: 0 },
    historicoEstoque: [],
    historicoVendas: [],
    historicoFinanceiro: [],
    meta: {
      version: VERSION,
      updatedAt: null
    }
  });

  const $ = (id) => document.getElementById(id);
  const els = {
    dashSaldoTotal: $('dashSaldoTotal'),
    dashPix: $('dashPix'),
    dashDinheiro: $('dashDinheiro'),
    dashEstoqueTotal: $('dashEstoqueTotal'),
    dashVendasHoje: $('dashVendasHoje'),
    dashEntradaHoje: $('dashEntradaHoje'),
    dashSaidaHoje: $('dashSaidaHoje'),
    dashResultadoHoje: $('dashResultadoHoje'),
    stockNinho: $('stockNinho'),
    stockTradicional: $('stockTradicional'),
    stockMisto: $('stockMisto'),
    formEstoque: $('formEstoque'),
    estoqueSabor: $('estoqueSabor'),
    estoqueQuantidade: $('estoqueQuantidade'),
    estoqueObservacao: $('estoqueObservacao'),
    formVenda: $('formVenda'),
    vendaSabor: $('vendaSabor'),
    vendaQuantidade: $('vendaQuantidade'),
    vendaPagamento: $('vendaPagamento'),
    vendaValor: $('vendaValor'),
    formGasto: $('formGasto'),
    gastoNome: $('gastoNome'),
    gastoValor: $('gastoValor'),
    gastoPagamento: $('gastoPagamento'),
    formEntradaManual: $('formEntradaManual'),
    entradaDescricao: $('entradaDescricao'),
    entradaValor: $('entradaValor'),
    entradaTipo: $('entradaTipo'),
    listaHistoricoEstoque: $('listaHistoricoEstoque'),
    listaHistoricoVendas: $('listaHistoricoVendas'),
    listaHistoricoFinanceiro: $('listaHistoricoFinanceiro'),
    btnExportarBackup: $('btnExportarBackup'),
    btnImportarBackup: $('btnImportarBackup'),
    btnResetarTudo: $('btnResetarTudo'),
    inputImportarBackup: $('inputImportarBackup'),
    btnLimparHistoricos: $('btnLimparHistoricos'),
    filtroHistorico: $('filtroHistorico'),
    tabEstoque: $('tabEstoque'),
    tabVendas: $('tabVendas'),
    tabFinanceiro: $('tabFinanceiro'),
    versaoBadge: $('versaoBadge'),
    toast: $('toast')
  };

  let state = loadState();
  let toastTimer = null;

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function sanitizeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function normalizeMoneyInput(value) {
    if (typeof value === 'string') {
      value = value.replace(',', '.');
    }
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    if (num <= 0) return null;
    return Number(num.toFixed(2));
  }

  function toPositiveInteger(value) {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) return null;
    return num;
  }

  function formatBRL(value) {
    return safeNumber(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function capitalize(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  function getNow() {
    return new Date();
  }

  function getIsoNow() {
    return getNow().toISOString();
  }

  function getTodayKey(dateLike = getNow()) {
    const date = new Date(dateLike);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateTime(dateIso) {
    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleString('pt-BR');
  }

  function createId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function calculateSaleTotal(quantity) {
    if (!quantity || quantity <= 0) return 0;
    return Number((quantity === 1 ? PRICE_SINGLE : quantity * PRICE_BULK).toFixed(2));
  }

  function todaySummary() {
    const today = getTodayKey();
    let salesCount = 0;
    let income = 0;
    let expense = 0;

    for (const item of state.historicoVendas) {
      if (item.dayKey === today) {
        salesCount += safeNumber(item.quantidade);
        income += safeNumber(item.valor);
      }
    }

    for (const item of state.historicoFinanceiro) {
      if (item.dayKey === today && item.kind === 'expense') {
        expense += Math.abs(safeNumber(item.valor));
      }
    }

    return {
      salesCount,
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      result: Number((income - expense).toFixed(2))
    };
  }

  function totalEstoque() {
    return FLAVORS.reduce((sum, flavor) => sum + safeNumber(state.estoque[flavor]), 0);
  }

  function totalSaldo() {
    return Number((safeNumber(state.financeiro.pix) + safeNumber(state.financeiro.dinheiro)).toFixed(2));
  }

  function migrateState(parsed) {
    return {
      estoque: {
        ninho: Math.max(0, safeNumber(parsed?.estoque?.ninho)),
        tradicional: Math.max(0, safeNumber(parsed?.estoque?.tradicional)),
        misto: Math.max(0, safeNumber(parsed?.estoque?.misto))
      },
      financeiro: {
        pix: Number(Math.max(0, safeNumber(parsed?.financeiro?.pix)).toFixed(2)),
        dinheiro: Number(Math.max(0, safeNumber(parsed?.financeiro?.dinheiro)).toFixed(2))
      },
      historicoEstoque: Array.isArray(parsed?.historicoEstoque) ? parsed.historicoEstoque.slice(0, HISTORY_LIMIT) : [],
      historicoVendas: Array.isArray(parsed?.historicoVendas) ? parsed.historicoVendas.slice(0, HISTORY_LIMIT) : [],
      historicoFinanceiro: Array.isArray(parsed?.historicoFinanceiro) ? parsed.historicoFinanceiro.slice(0, HISTORY_LIMIT) : [],
      meta: {
        version: VERSION,
        updatedAt: parsed?.meta?.updatedAt || null
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultState();
      return migrateState(JSON.parse(raw));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      return cloneDefaultState();
    }
  }

  function saveState() {
    try {
      state.meta.updatedAt = getIsoNow();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      showToast('Erro ao salvar dados no aparelho.');
      return false;
    }
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove('show');
    }, 2600);
  }

  function addHistory(targetKey, entry) {
    const iso = getIsoNow();
    const payload = {
      id: createId(targetKey),
      createdAt: iso,
      dayKey: getTodayKey(iso),
      ...entry
    };
    state[targetKey].unshift(payload);
    if (state[targetKey].length > HISTORY_LIMIT) {
      state[targetKey].length = HISTORY_LIMIT;
    }
  }

  function setStock(flavor, value) {
    state.estoque[flavor] = Math.max(0, safeNumber(value));
  }

  function setFinance(type, value) {
    state.financeiro[type] = Number(Math.max(0, safeNumber(value)).toFixed(2));
  }

  function renderDashboard() {
    const day = todaySummary();
    els.dashSaldoTotal.textContent = formatBRL(totalSaldo());
    els.dashPix.textContent = formatBRL(state.financeiro.pix);
    els.dashDinheiro.textContent = formatBRL(state.financeiro.dinheiro);
    els.dashEstoqueTotal.textContent = String(totalEstoque());
    els.dashVendasHoje.textContent = String(day.salesCount);
    els.dashEntradaHoje.textContent = formatBRL(day.income);
    els.dashSaidaHoje.textContent = formatBRL(day.expense);
    els.dashResultadoHoje.textContent = formatBRL(day.result);
    els.stockNinho.textContent = String(state.estoque.ninho);
    els.stockTradicional.textContent = String(state.estoque.tradicional);
    els.stockMisto.textContent = String(state.estoque.misto);
    els.versaoBadge.textContent = `V${VERSION}`;
  }

  function getFilteredItems(items) {
    if (els.filtroHistorico.value !== 'hoje') return items;
    const today = getTodayKey();
    return items.filter((item) => item.dayKey === today);
  }

  function renderList(target, items, formatter) {
    target.innerHTML = '';
    const filtered = getFilteredItems(items);
    if (!filtered.length) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'Nenhum registro encontrado.';
      target.appendChild(li);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of filtered) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = formatter(item);
      fragment.appendChild(li);
    }
    target.appendChild(fragment);
  }

  function renderHistories() {
    renderList(els.listaHistoricoEstoque, state.historicoEstoque, (item) => {
      const title = item.tipo === 'entrada' ? 'Entrada de estoque' : 'Saída de estoque';
      const obs = item.observacao ? `<div>Obs.: ${escapeHtml(item.observacao)}</div>` : '';
      return `
        <strong>${title}</strong>
        <div>${capitalize(item.sabor)} • ${item.quantidade} caixa(s)</div>
        ${obs}
        <div class="history-meta">${formatDateTime(item.createdAt)}</div>
      `;
    });

    renderList(els.listaHistoricoVendas, state.historicoVendas, (item) => `
      <strong>Venda de ${item.quantidade} caixa(s)</strong>
      <div>${capitalize(item.sabor)} • ${capitalize(item.pagamento)} • ${formatBRL(item.valor)}</div>
      <div class="history-meta">${formatDateTime(item.createdAt)}</div>
    `);

    renderList(els.listaHistoricoFinanceiro, state.historicoFinanceiro, (item) => `
      <strong>${escapeHtml(item.titulo)}</strong>
      <div>${escapeHtml(item.descricao)}</div>
      <div>${formatBRL(item.valor)} • ${item.canal ? capitalize(item.canal) : 'Saldo geral'}</div>
      <div class="history-meta">${formatDateTime(item.createdAt)}</div>
    `);
  }

  function renderAll() {
    renderDashboard();
    renderHistories();
    updateSalePreview();
  }

  function persistAndRender(message) {
    if (saveState()) {
      renderAll();
      if (message) showToast(message);
    }
  }

  function updateSalePreview() {
    const quantity = toPositiveInteger(els.vendaQuantidade.value);
    els.vendaValor.value = formatBRL(calculateSaleTotal(quantity || 0));
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function validateFlavor(flavor) {
    return FLAVORS.includes(flavor);
  }

  function validatePayment(payment) {
    return PAYMENT_TYPES.includes(payment);
  }

  function handleAddStock(event) {
    event.preventDefault();
    const flavor = sanitizeText(els.estoqueSabor.value).toLowerCase();
    const quantity = toPositiveInteger(els.estoqueQuantidade.value);
    const note = sanitizeText(els.estoqueObservacao.value);

    if (!validateFlavor(flavor)) {
      showToast('Selecione um sabor válido.');
      return;
    }
    if (!quantity) {
      showToast('Informe uma quantidade válida.');
      return;
    }

    setStock(flavor, state.estoque[flavor] + quantity);
    addHistory('historicoEstoque', {
      tipo: 'entrada',
      sabor: flavor,
      quantidade: quantity,
      observacao: note
    });

    els.formEstoque.reset();
    persistAndRender('Estoque adicionado com sucesso.');
  }

  function handleSale(event) {
    event.preventDefault();
    const flavor = sanitizeText(els.vendaSabor.value).toLowerCase();
    const quantity = toPositiveInteger(els.vendaQuantidade.value);
    const payment = sanitizeText(els.vendaPagamento.value).toLowerCase();

    if (!validateFlavor(flavor)) {
      showToast('Selecione um tipo de caixa válido.');
      return;
    }
    if (!quantity) {
      showToast('Informe uma quantidade válida para venda.');
      return;
    }
    if (!validatePayment(payment)) {
      showToast('Selecione um método de pagamento.');
      return;
    }
    if (state.estoque[flavor] < quantity) {
      showToast('Estoque insuficiente para essa venda.');
      return;
    }

    const total = calculateSaleTotal(quantity);
    setStock(flavor, state.estoque[flavor] - quantity);
    setFinance(payment, state.financeiro[payment] + total);

    addHistory('historicoEstoque', {
      tipo: 'saida',
      sabor: flavor,
      quantidade: quantity,
      observacao: 'Venda registrada'
    });

    addHistory('historicoVendas', {
      sabor: flavor,
      quantidade: quantity,
      pagamento: payment,
      valor: total
    });

    addHistory('historicoFinanceiro', {
      kind: 'income',
      titulo: 'Entrada por venda',
      descricao: `${quantity} caixa(s) de ${capitalize(flavor)}`,
      valor: total,
      canal: payment
    });

    els.formVenda.reset();
    persistAndRender('Venda registrada com sucesso.');
  }

  function debitExpense(value, payment) {
    setFinance(payment, state.financeiro[payment] - value);
  }

  function handleExpense(event) {
    event.preventDefault();
    const name = sanitizeText(els.gastoNome.value);
    const value = normalizeMoneyInput(els.gastoValor.value);
    const payment = sanitizeText(els.gastoPagamento.value).toLowerCase();

    if (!name) {
      showToast('Informe a descrição do gasto.');
      return;
    }
    if (!value) {
      showToast('Informe um valor de gasto válido.');
      return;
    }
    if (!validatePayment(payment)) {
      showToast('Selecione a forma de pagamento do gasto.');
      return;
    }
    if (state.financeiro[payment] < value) {
      showToast(`Saldo insuficiente em ${payment === 'pix' ? 'PIX' : 'dinheiro'} para registrar esse gasto.`);
      return;
    }

    debitExpense(value, payment);
    addHistory('historicoFinanceiro', {
      kind: 'expense',
      titulo: 'Saída financeira',
      descricao: name,
      valor: -value,
      canal: payment
    });

    els.formGasto.reset();
    persistAndRender('Gasto registrado com sucesso.');
  }

  function handleManualEntry(event) {
    event.preventDefault();
    const description = sanitizeText(els.entradaDescricao.value);
    const value = normalizeMoneyInput(els.entradaValor.value);
    const type = sanitizeText(els.entradaTipo.value).toLowerCase();

    if (!description) {
      showToast('Informe a descrição da entrada.');
      return;
    }
    if (!value) {
      showToast('Informe um valor válido.');
      return;
    }
    if (!validatePayment(type)) {
      showToast('Selecione onde deseja adicionar a entrada.');
      return;
    }

    setFinance(type, state.financeiro[type] + value);
    addHistory('historicoFinanceiro', {
      kind: 'income',
      titulo: 'Entrada manual',
      descricao: description,
      valor: value,
      canal: type
    });

    els.formEntradaManual.reset();
    persistAndRender('Entrada manual adicionada com sucesso.');
  }

  function activateTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });
    els.tabEstoque.classList.toggle('active', tabName === 'estoque');
    els.tabVendas.classList.toggle('active', tabName === 'vendas');
    els.tabFinanceiro.classList.toggle('active', tabName === 'financeiro');
  }

  function exportBackup() {
    try {
      const payload = {
        exportedAt: getIsoNow(),
        version: VERSION,
        app: 'Puro Doce Gourmet',
        data: state
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `puro-doce-backup-${getTodayKey()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Backup exportado com sucesso.');
    } catch (error) {
      console.error(error);
      showToast('Erro ao exportar backup.');
    }
  }

  function importBackupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const importedData = parsed?.data ?? parsed;
        state = migrateState(importedData);
        persistAndRender('Backup importado com sucesso.');
      } catch (error) {
        console.error(error);
        showToast('Arquivo de backup inválido.');
      } finally {
        els.inputImportarBackup.value = '';
      }
    };
    reader.onerror = () => {
      showToast('Falha ao ler o arquivo de backup.');
      els.inputImportarBackup.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  function clearHistories() {
    if (!window.confirm('Deseja realmente apagar todos os históricos?')) return;
    state.historicoEstoque = [];
    state.historicoVendas = [];
    state.historicoFinanceiro = [];
    persistAndRender('Históricos apagados.');
  }

  function resetEverything() {
    if (!window.confirm('Isso apaga estoque, financeiro e históricos. Deseja continuar?')) return;
    state = cloneDefaultState();
    persistAndRender('Sistema resetado com sucesso.');
  }

  function bindEvents() {
    els.formEstoque.addEventListener('submit', handleAddStock);
    els.formVenda.addEventListener('submit', handleSale);
    els.formGasto.addEventListener('submit', handleExpense);
    els.formEntradaManual.addEventListener('submit', handleManualEntry);

    els.vendaQuantidade.addEventListener('input', updateSalePreview);
    els.btnExportarBackup.addEventListener('click', exportBackup);
    els.btnImportarBackup.addEventListener('click', () => els.inputImportarBackup.click());
    els.inputImportarBackup.addEventListener('change', (event) => importBackupFile(event.target.files?.[0]));
    els.btnLimparHistoricos.addEventListener('click', clearHistories);
    els.btnResetarTudo.addEventListener('click', resetEverything);
    els.filtroHistorico.addEventListener('change', renderHistories);

    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.addEventListener('click', () => activateTab(button.dataset.tab));
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveState();
    });
    window.addEventListener('pagehide', saveState);
    window.addEventListener('beforeunload', saveState);
  }

  function init() {
    document.title = 'Puro Doce Gourmet';
    bindEvents();
    activateTab('estoque');
    renderAll();
  }

  init();
})();
