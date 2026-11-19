// ==========================================
// DADOS PADRÃO INICIAIS (SEED EM REAIS - R$)
// ==========================================
const DEFAULT_DB = {
    usuarios: [
        { id: 1, login: "admin", senha: "admin", nome: "Administrador Master", role: "admin" },
        { id: 2, login: "gestor", senha: "gestor", nome: "Gestor Logístico", role: "gestor" },
        { id: 3, login: "colab", senha: "colab", nome: "João Operador", role: "colaborador" }
    ],
    blocos: [
        { id: 1, nome: "Sala de Servidores", endereco: "Prédio Principal, 1º Andar", coord_x: 25, coord_y: 35 },
        { id: 2, nome: "Armazém Suporte", endereco: "Anexo Almoxarifado, Galpão B", coord_x: 75, coord_y: 25 },
        { id: 3, nome: "Bancada Principal", endereco: "Prédio Principal, Térreo", coord_x: 50, coord_y: 70 }
    ],
    ativos: [
        { id: 1, bloco_id: 2, codigo: "NOTE#001", num_serie: "SN12345", uid_rfid: "04:6A:B2:91", nome: "Notebook Dell Latitude", valor: 4850.00, estado: "Disponível", posse_user_id: null, destino_atual: null, data_emprestimo: null },
        { id: 2, bloco_id: 3, codigo: "FERR#001", num_serie: "SN99887", uid_rfid: "04:8F:C3:44", nome: "Multímetro Fluke", valor: 1290.50, estado: "Emprestado", posse_user_id: 3, destino_atual: "Bancada Principal", data_emprestimo: "18/11/2026 08:30" },
        { id: 3, bloco_id: 1, codigo: "SRV#001", num_serie: "SN55443", uid_rfid: "04:1A:E9:00", nome: "Switch Cisco 24p", valor: 6400.00, estado: "Disponível", posse_user_id: null, destino_atual: null, data_emprestimo: null },
        { id: 4, bloco_id: 2, codigo: "MON#001", num_serie: "SN11223", uid_rfid: "04:2B:C4:11", nome: "Monitor LG 29", valor: 1150.00, estado: "Manutenção", posse_user_id: null, destino_atual: null, data_emprestimo: null },
        { id: 5, bloco_id: 3, codigo: "FERR#002", num_serie: "SN44556", uid_rfid: "04:7C:D5:22", nome: "Parafusadeira Makita", valor: 780.00, estado: "Extraviado", posse_user_id: null, destino_atual: null, data_emprestimo: null }
    ],
    movimentacoes: [
        { data: "18/11/2026 08:30", ativo: "Multímetro Fluke", acao: "Empréstimo", user: "Gestor Logístico", detalhe: "Colaborador: João Operador | Destino: Bancada Principal" },
        { data: "15/11/2026 14:15", ativo: "Monitor LG 29", acao: "Ocorrência", user: "Gestor Logístico", detalhe: "Display apresentando falhas" },
        { data: "10/11/2026 17:00", ativo: "Parafusadeira Makita", acao: "Extravio", user: "Administrador Master", detalhe: "Não encontrada na vistoria" }
    ],
    mapaCustomizado: null
};

// Carrega o banco salvo no navegador ou cria a partir do padrão
let DB = JSON.parse(localStorage.getItem('VELORA_DB')) || JSON.parse(JSON.stringify(DEFAULT_DB));

// Garante compatibilidade caso já existam dados salvos sem o campo 'valor'
DB.ativos.forEach(a => {
    if (typeof a.valor !== 'number') a.valor = 0;
});

function saveDB() {
    localStorage.setItem('VELORA_DB', JSON.stringify(DB));
}

// ==========================================
// UTILITÁRIOS DE MOEDA (REAL - BRL) E DATA
// ==========================================
function formatBRL(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getNowInputFormat() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function formatDateTimeBR(isoString) {
    if (!isoString) return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const [datePart, timePart] = isoString.split('T');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year} ${timePart}`;
}

// ==========================================
// CORE APP ENGINE
// ==========================================
const app = {
    currentUser: null,
    html5QrCode: null,

    resetDB() {
        if (confirm("Deseja apagar todos os registros feitos e restaurar os dados originais de fábrica?")) {
            localStorage.removeItem('VELORA_DB');
            DB = JSON.parse(JSON.stringify(DEFAULT_DB));
            saveDB();
            alert("Banco de dados restaurado com sucesso!");
            this.navigate('dashboard-view');
        }
    },

    // --- AUTENTICAÇÃO ---
    login() {
        const userIn = document.getElementById('user-input').value.trim();
        const passIn = document.getElementById('pass-input').value.trim();
        
        const usuario = DB.usuarios.find(u => u.login === userIn && u.senha === passIn);

        if (usuario) {
            this.currentUser = usuario;
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('hidden');
            document.getElementById('app-view').style.display = window.innerWidth > 768 ? 'flex' : 'block';
            this.applyPermissions();
        } else {
            alert("Credenciais incorretas! Verifique seu usuário e senha.");
        }
    },

    logout() {
        this.fecharScannerCamera();
        this.currentUser = null;
        document.getElementById('user-input').value = '';
        document.getElementById('pass-input').value = '';
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('app-view').style.display = 'none';
        document.getElementById('login-view').classList.remove('hidden');
    },

    // --- PERMISSÕES E NAVEGAÇÃO ---
    applyPermissions() {
        const role = this.currentUser.role;
        
        document.getElementById('display-user-name').innerText = this.currentUser.nome;
        document.getElementById('display-user-role').innerText = role.toUpperCase();

        const allNavs = ['nav-dashboard', 'nav-assets', 'nav-mov', 'nav-my-assets', 'nav-locations', 'nav-admin-panel', 'nav-map'];
        allNavs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const btnAddAsset = document.getElementById('btn-add-asset');
        const thAcoes = document.getElementById('th-acoes');

        if (role === 'admin') {
            ['nav-dashboard', 'nav-assets', 'nav-mov', 'nav-locations', 'nav-admin-panel', 'nav-map'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'flex';
            });
            if (btnAddAsset) btnAddAsset.style.display = 'inline-block';
            if (thAcoes) thAcoes.style.display = 'table-cell';
            this.activateNav('nav-dashboard', 'dashboard-view');
        } 
        else if (role === 'gestor') {
            ['nav-dashboard', 'nav-assets', 'nav-mov', 'nav-locations', 'nav-map'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'flex';
            });
            if (btnAddAsset) btnAddAsset.style.display = 'none';
            if (thAcoes) thAcoes.style.display = 'table-cell';
            this.activateNav('nav-dashboard', 'dashboard-view');
        } 
        else if (role === 'colaborador') {
            ['nav-my-assets', 'nav-locations', 'nav-map'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'flex';
            });
            this.activateNav('nav-my-assets', 'my-assets-view');
        }
    },

    activateNav(navId, viewId) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const navEl = document.getElementById(navId);
        if (navEl) navEl.classList.add('active');
        this.navigate(viewId);
    },

    navigate(viewId) {
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.remove('hidden');

        if (viewId === 'dashboard-view') this.renderDashboard();
        if (viewId === 'assets-view') this.renderAssetsTable();
        if (viewId === 'mov-view') this.renderMovTable();
        if (viewId === 'my-assets-view') this.renderMyAssets();
        if (viewId === 'locations-view') this.renderLocationsTable();
        if (viewId === 'reports-view') this.renderReportsTable();
        if (viewId === 'map-view') this.renderBlueprint();
        if (viewId === 'employees-view') this.renderEmployeesTable();
        if (viewId === 'sectors-view') this.renderSectorsTable();
    },

    // --- CADASTROS (ADMIN) ---
    addAsset() {
        const nome = prompt("Nome do Novo Equipamento:");
        if (!nome) return;
        const codigo = prompt("Código Interno (Ex: NOTE#005):") || `NEW#${Math.floor(Math.random()*1000)}`;
        const serie = prompt("Número de Série:") || "Não informado";
        const valorStr = prompt("Valor de Aquisição em Reais (Ex: 2500,00):") || "0";
        const valorNum = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;
        
        DB.ativos.push({
            id: DB.ativos.length + 1,
            bloco_id: 1,
            codigo: codigo.toUpperCase(),
            num_serie: serie.toUpperCase(),
            uid_rfid: "4A:00:FF:99",
            nome: nome,
            valor: valorNum,
            estado: "Disponível",
            posse_user_id: null,
            destino_atual: null,
            data_emprestimo: null
        });
        
        saveDB();
        alert(`Equipamento '${nome}' (${formatBRL(valorNum)}) cadastrado com sucesso!`);
        this.renderAssetsTable();
    },

    addEmployee() {
        const nome = prompt("Nome completo do funcionário:");
        if (!nome) return;
        const login = prompt("Crie o login de acesso:");
        if (!login) return;
        const senha = prompt("Crie a senha de acesso:") || "123";
        let role = prompt("Qual o perfil? (Digite 'admin', 'gestor' ou 'colaborador')").toLowerCase().trim();
        
        if (!['admin', 'gestor', 'colaborador'].includes(role)) {
            role = 'colaborador';
        }

        DB.usuarios.push({
            id: DB.usuarios.length + 1,
            login: login,
            senha: senha,
            nome: nome,
            role: role
        });
        
        saveDB();
        alert(`O usuário ${nome} foi salvo no banco como ${role.toUpperCase()}.`);
        this.renderEmployeesTable();
    },

    addSector() {
        const nome = prompt("Nome do Setor/Bloco:");
        if (!nome) return;
        const endereco = prompt("Endereço ou Referência:") || "Sem endereço físico";
        
        DB.blocos.push({
            id: DB.blocos.length + 1,
            nome: nome,
            endereco: endereco,
            coord_x: Math.floor(Math.random() * 70) + 15,
            coord_y: Math.floor(Math.random() * 70) + 15
        });
        
        saveDB();
        alert(`Setor '${nome}' registrado e salvo no banco.`);
        this.renderSectorsTable();
    },

    // --- FORMULÁRIO DE EMPRÉSTIMO (RETIRADA) ---
    abrirModalEmprestimo(id) {
        const ativo = DB.ativos.find(a => a.id === id);
        if (!ativo) return;
        if (ativo.estado !== 'Disponível') {
            return alert('Atenção: Apenas ativos com status "Disponível" podem ser emprestados.');
        }

        document.getElementById('loan-asset-id').value = ativo.id;
        document.getElementById('loan-asset-name').value = `${ativo.nome} (${ativo.codigo}) - ${formatBRL(ativo.valor)}`;
        document.getElementById('loan-gestor-name').value = this.currentUser.nome;
        document.getElementById('loan-datetime').value = getNowInputFormat();

        const colabSelect = document.getElementById('loan-colab-select');
        colabSelect.innerHTML = DB.usuarios.map(u => 
            `<option value="${u.id}">${u.nome} (${u.role.toUpperCase()})</option>`
        ).join('');
        const defaultColab = DB.usuarios.find(u => u.role === 'colaborador');
        if (defaultColab) colabSelect.value = defaultColab.id;

        const destinoSelect = document.getElementById('loan-destino-select');
        destinoSelect.innerHTML = DB.blocos.map(b => 
            `<option value="${b.nome}">${b.nome} - ${b.endereco}</option>`
        ).join('');

        document.getElementById('loan-modal').classList.remove('hidden');
    },

    confirmarEmprestimo() {
        const ativoId = parseInt(document.getElementById('loan-asset-id').value);
        const colabId = parseInt(document.getElementById('loan-colab-select').value);
        const destino = document.getElementById('loan-destino-select').value;
        const rawDateTime = document.getElementById('loan-datetime').value;
        const dataHoraFormatada = formatDateTimeBR(rawDateTime);

        const ativo = DB.ativos.find(a => a.id === ativoId);
        const colaborador = DB.usuarios.find(u => u.id === colabId);

        if (!ativo || !colaborador) return;

        ativo.estado = 'Emprestado';
        ativo.posse_user_id = colaborador.id;
        ativo.destino_atual = destino;
        ativo.data_emprestimo = dataHoraFormatada;

        DB.movimentacoes.unshift({
            data: dataHoraFormatada,
            ativo: `${ativo.nome} (${ativo.codigo})`,
            acao: "Empréstimo",
            user: this.currentUser.nome,
            detalhe: `Colaborador: ${colaborador.nome} | Destino: ${destino}`
        });

        saveDB();
        this.closeModal('loan-modal');
        this.renderAssetsTable();
        alert(`Empréstimo de "${ativo.nome}" registrado com sucesso para ${colaborador.nome}!`);
    },

    // --- FORMULÁRIO DE DEVOLUÇÃO ---
    abrirModalDevolucao(id) {
        const ativo = DB.ativos.find(a => a.id === id);
        if (!ativo) return;
        if (ativo.estado !== 'Emprestado') {
            return alert('Este equipamento não consta como emprestado.');
        }

        const colabAtual = DB.usuarios.find(u => u.id === ativo.posse_user_id);

        document.getElementById('return-asset-id').value = ativo.id;
        document.getElementById('return-asset-name').value = `${ativo.nome} (${ativo.codigo})`;
        document.getElementById('return-colab-name').value = colabAtual ? colabAtual.nome : 'Não identificado';
        document.getElementById('return-datetime').value = getNowInputFormat();

        document.getElementById('return-modal').classList.remove('hidden');
    },

    confirmarDevolucao() {
        const ativoId = parseInt(document.getElementById('return-asset-id').value);
        const rawDateTime = document.getElementById('return-datetime').value;
        const dataHoraFormatada = formatDateTimeBR(rawDateTime);

        const ativo = DB.ativos.find(a => a.id === ativoId);
        if (!ativo) return;

        const colabAnterior = DB.usuarios.find(u => u.id === ativo.posse_user_id);
        const nomeColab = colabAnterior ? colabAnterior.nome : 'Colaborador';

        ativo.estado = 'Disponível';
        ativo.posse_user_id = null;
        ativo.destino_atual = null;
        ativo.data_emprestimo = null;

        DB.movimentacoes.unshift({
            data: dataHoraFormatada,
            ativo: `${ativo.nome} (${ativo.codigo})`,
            acao: "Devolução",
            user: this.currentUser.nome,
            detalhe: `Devolvido por: ${nomeColab} | Retornou ao estoque`
        });

        saveDB();
        this.closeModal('return-modal');
        this.renderAssetsTable();
        alert(`Devolução de "${ativo.nome}" registrada em ${dataHoraFormatada}!`);
    },

    // --- OUTRAS AÇÕES DO INVENTÁRIO ---
    registrarOcorrencia(id) {
        const ativo = DB.ativos.find(a => a.id === id);
        const descricao = prompt(`Descreva a ocorrência/defeito para ${ativo.nome}:`);
        
        if (descricao) {
            ativo.estado = 'Manutenção';
            const agora = formatDateTimeBR();
            DB.movimentacoes.unshift({ 
                data: agora, 
                ativo: `${ativo.nome} (${ativo.codigo})`, 
                acao: "Ocorrência", 
                user: this.currentUser.nome, 
                detalhe: descricao 
            });
            saveDB();
            this.renderAssetsTable();
        }
    },

    registrarBaixa(id) {
        const ativo = DB.ativos.find(a => a.id === id);
        const motivo = prompt(`ATENÇÃO: Baixa permanente para ${ativo.nome}. Informe o motivo (Ex: Extravio, Descarte, Roubo):`);
        
        if (motivo) {
            ativo.estado = 'Extraviado';
            ativo.posse_user_id = null;
            ativo.destino_atual = null;
            const agora = formatDateTimeBR();
            DB.movimentacoes.unshift({ 
                data: agora, 
                ativo: `${ativo.nome} (${ativo.codigo})`, 
                acao: "Baixa / Extravio", 
                user: this.currentUser.nome, 
                detalhe: motivo 
            });
            saveDB();
            this.renderAssetsTable();
        }
    },

    // --- RENDERIZAÇÃO DAS TABELAS ---
    renderDashboard() {
        const container = document.getElementById('metrics-container');
        if (!container) return;
        
        const total = DB.ativos.length;
        const emprestados = DB.ativos.filter(a => a.estado === 'Emprestado').length;
        const ocorrencias = DB.ativos.filter(a => a.estado === 'Manutenção' || a.estado === 'Extraviado').length;
        const valorTotalPatrimonio = DB.ativos
            .filter(a => a.estado !== 'Extraviado')
            .reduce((acc, a) => acc + (Number(a.valor) || 0), 0);
        
        container.innerHTML = `
            <div class="metric-card">
                <h3>Total de Ativos</h3><div class="metric-value" style="color: var(--primary);">${total}</div>
            </div>
            <div class="metric-card" style="border-top-color: var(--secondary);">
                <h3>Valor Patrimonial</h3><div class="metric-value" style="color: var(--secondary); font-size: 2rem;">${formatBRL(valorTotalPatrimonio)}</div>
            </div>
            <div class="metric-card" style="border-top-color: var(--secondary-light);">
                <h3>Emprestados / Em Uso</h3><div class="metric-value" style="color: var(--secondary-light);">${emprestados}</div>
            </div>
            <div class="metric-card" style="border-top-color: #dc2626;">
                <h3>Manutenção / Extravio</h3><div class="metric-value" style="color: #dc2626;">${ocorrencias}</div>
            </div>
        `;
    },

    renderEmployeesTable() {
        const tbody = document.querySelector('#employeesTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = DB.usuarios.map(u => `
            <tr>
                <td>${u.id}</td>
                <td><strong>${u.nome}</strong></td>
                <td>${u.login}</td>
                <td><span class="badge badge-gray">${u.role.toUpperCase()}</span></td>
            </tr>
        `).join('');
    },

    renderSectorsTable() {
        const tbody = document.querySelector('#sectorsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = DB.blocos.map(b => `
            <tr>
                <td>${b.id}</td>
                <td><strong>${b.nome}</strong></td>
                <td>${b.endereco}</td>
            </tr>
        `).join('');
    },

    renderAssetsTable(filter = "") {
        const tbody = document.querySelector('#assetsTable tbody');
        if (!tbody) return;
        
        const termo = filter.toLowerCase();
        const role = this.currentUser.role;
        
        const ativosFiltrados = DB.ativos.filter(a => 
            a.codigo.toLowerCase().includes(termo) || 
            a.nome.toLowerCase().includes(termo) ||
            a.uid_rfid.toLowerCase().includes(termo)
        );

        const html = ativosFiltrados.map(ativo => {
            const bloco = DB.blocos.find(b => b.id === ativo.bloco_id);
            
            let textoLocal = bloco ? bloco.nome : 'Estoque';
            if (ativo.estado === 'Emprestado' && ativo.posse_user_id !== null) {
                const userComPosse = DB.usuarios.find(u => u.id === ativo.posse_user_id);
                const nomeColab = userComPosse ? userComPosse.nome : 'Colaborador';
                textoLocal = `👤 <strong>${nomeColab}</strong><br><small>Destino: ${ativo.destino_atual || 'Não inf.'} (${ativo.data_emprestimo || ''})</small>`;
            }
            
            let badgeClass = 'badge-gray';
            if (ativo.estado === 'Disponível') badgeClass = 'badge-green';
            if (ativo.estado === 'Emprestado') badgeClass = 'badge-blue';
            if (ativo.estado === 'Manutenção') badgeClass = 'badge-purple';
            if (ativo.estado === 'Extraviado') badgeClass = 'badge-red';
            
            let actionHtml = '';
            if (role === 'admin' || role === 'gestor') {
                const btnEmprestimo = ativo.estado === 'Disponível' 
                    ? `<button class="action-btn" style="background: var(--primary); color: white; border-color: var(--primary);" onclick="app.abrirModalEmprestimo(${ativo.id})">Emprestar</button>` 
                    : '';
                const btnDevolucao = ativo.estado === 'Emprestado' 
                    ? `<button class="action-btn" style="background: var(--secondary); color: white; border-color: var(--secondary);" onclick="app.abrirModalDevolucao(${ativo.id})">Devolver</button>` 
                    : '';

                actionHtml = `
                    ${btnEmprestimo}
                    ${btnDevolucao}
                    <button class="action-btn" onclick="app.registrarOcorrencia(${ativo.id})">Ocorrência</button>
                    ${role === 'admin' ? `<button class="action-btn" onclick="app.registrarBaixa(${ativo.id})">Baixa</button>` : ''}
                    ${role === 'admin' ? `<button class="btn-icon" onclick="app.generateQR('${ativo.codigo}', '${ativo.nome}')" title="Gerar Etiqueta"><i class="fa-solid fa-qrcode"></i></button>` : ''}
                `;
            }

            return `<tr>
                <td><strong>${ativo.nome}</strong><br><small>S/N: ${ativo.num_serie}</small></td>
                <td><span style="color: var(--primary); font-weight:600;">${ativo.codigo}</span><br><small>RFID: ${ativo.uid_rfid}</small></td>
                <td><strong>${formatBRL(ativo.valor)}</strong></td>
                <td>${textoLocal}</td>
                <td><span class="badge ${badgeClass}">${ativo.estado}</span></td>
                ${role !== 'colaborador' ? `<td>${actionHtml}</td>` : ''}
            </tr>`;
        }).join('');

        tbody.innerHTML = html || `<tr><td colspan="6" style="text-align:center; padding: 30px;">Nenhum ativo localizado.</td></tr>`;
    },

    renderLocationsTable() {
        const tbody = document.querySelector('#locationsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = DB.blocos.map(bloco => {
            const qtdAtivos = DB.ativos.filter(a => a.bloco_id === bloco.id && a.posse_user_id === null).length;
            return `
            <tr>
                <td><strong>${bloco.nome}</strong></td>
                <td><i class="fa-solid fa-location-dot" style="color: var(--primary-light); margin-right: 5px;"></i> ${bloco.endereco}</td>
                <td><span class="badge badge-gray">${qtdAtivos} equipamento(s) no setor</span></td>
            </tr>`;
        }).join('');
    },

    renderReportsTable() {
        const tbody = document.querySelector('#reportTable tbody');
        if (!tbody) return;
        
        let somaTotal = 0;
        tbody.innerHTML = DB.ativos.map(ativo => {
            if (ativo.estado !== 'Extraviado') somaTotal += (Number(ativo.valor) || 0);
            const bloco = DB.blocos.find(b => b.id === ativo.bloco_id);
            const userPosse = ativo.posse_user_id ? DB.usuarios.find(u => u.id === ativo.posse_user_id).nome : (bloco ? bloco.nome : 'Estoque');
            return `
            <tr>
                <td>${ativo.id}</td>
                <td><strong>${ativo.nome}</strong><br><small>${ativo.num_serie}</small></td>
                <td>${ativo.codigo} / ${ativo.uid_rfid}</td>
                <td><strong>${formatBRL(ativo.valor)}</strong></td>
                <td>${userPosse}</td>
                <td>${ativo.estado}</td>
            </tr>`;
        }).join('');

        const totalBadge = document.getElementById('report-total-value');
        if (totalBadge) totalBadge.innerText = `Patrimônio Ativo Total: ${formatBRL(somaTotal)}`;
    },

    renderMovTable() {
        const tbody = document.querySelector('#movTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = DB.movimentacoes.map(m => {
            let badgeClass = 'badge-gray';
            if (m.acao === 'Empréstimo') badgeClass = 'badge-blue';
            if (m.acao === 'Devolução') badgeClass = 'badge-green';
            if (m.acao === 'Ocorrência') badgeClass = 'badge-purple';
            if (m.acao.includes('Extravio')) badgeClass = 'badge-red';

            return `
            <tr>
                <td><strong>${m.data}</strong></td>
                <td><strong>${m.ativo}</strong></td>
                <td><span class="badge ${badgeClass}">${m.acao}</span></td>
                <td>${m.user}</td>
                <td><small>${m.detalhe}</small></td>
            </tr>`;
        }).join('');
    },

    renderMyAssets() {
        const tbody = document.querySelector('#myAssetsTable tbody');
        if (!tbody) return;
        
        const meus = DB.ativos.filter(a => a.posse_user_id === this.currentUser.id);
        
        const html = meus.map(ativo => `
            <tr>
                <td><strong>${ativo.nome}</strong></td>
                <td>${ativo.codigo}</td>
                <td>${ativo.destino_atual || 'Local padrão'}</td>
                <td>${ativo.data_emprestimo || 'Registrado'}</td>
                <td><span class="badge badge-blue">Sob sua responsabilidade</span></td>
            </tr>
        `).join('');
        
        tbody.innerHTML = html || `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">Você não possui equipamentos sob sua responsabilidade neste momento.</td></tr>`;
    },

    searchAsset() {
        const query = document.getElementById("searchInput").value;
        this.renderAssetsTable(query);
    },

    simulateScan() {
        const input = prompt("Simulador Leitura RFID/QR Scanner\nBipe o equipamento (Digite um código como NOTE#001 ou UID RFID):");
        if (input) { 
            document.getElementById("searchInput").value = input; 
            this.searchAsset(); 
        }
    },

    // --- LEITOR DE CÂMERA REAL (HTML5-QRCODE) ---
    abrirScannerCamera() {
        const modal = document.getElementById('camera-modal');
        const statusEl = document.getElementById('camera-status');
        modal.classList.remove('hidden');
        statusEl.innerText = "Iniciando câmera...";

        if (typeof Html5Qrcode === 'undefined') {
            statusEl.innerText = "Biblioteca de câmera indisponível offline. Use a busca manual.";
            return;
        }

        this.html5QrCode = new Html5Qrcode("qr-reader");
        this.html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
                statusEl.innerText = `Código lido: ${decodedText}`;
                document.getElementById("searchInput").value = decodedText;
                this.searchAsset();
                this.fecharScannerCamera();
            },
            () => {}
        ).catch(err => {
            statusEl.innerText = "Não foi possível acessar a câmera (verifique permissões HTTPS/localhost).";
            console.warn("Erro câmera:", err);
        });
    },

    fecharScannerCamera() {
        const modal = document.getElementById('camera-modal');
        if (modal) modal.classList.add('hidden');
        if (this.html5QrCode) {
            this.html5QrCode.stop().then(() => {
                this.html5QrCode.clear();
                this.html5QrCode = null;
            }).catch(() => {});
        }
    },

    // --- QR CODE GERADO ---
    generateQR(codigo, nome) {
        document.getElementById('qr-title').innerText = nome;
        document.getElementById('qr-subtitle').innerText = `CÓD: ${codigo}`;
        
        const qrContainer = document.getElementById('qrcode-render');
        qrContainer.innerHTML = ""; 
        
        new QRCode(qrContainer, {
            text: codigo, 
            width: 180, 
            height: 180, 
            colorDark : "#6d28a8", 
            colorLight : "#ffffff", 
            correctLevel : QRCode.CorrectLevel.H
        });
        
        document.getElementById('qr-modal').classList.remove('hidden');
    },

    closeModal(modalId) { 
        document.getElementById(modalId).classList.add('hidden'); 
    },

    // --- PLANTA DE ENDEREÇAMENTO (COM IMAGEM CUSTOMIZADA) ---
    uploadMapImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            DB.mapaCustomizado = e.target.result;
            saveDB();
            this.renderBlueprint();
            alert("Imagem da planta carregada e salva com sucesso!");
        };
        reader.readAsDataURL(file);
    },

    resetMapImage() {
        DB.mapaCustomizado = null;
        saveDB();
        this.renderBlueprint();
    },

    renderBlueprint() {
        const map = document.getElementById('blueprint-map');
        const btnReset = document.getElementById('btn-reset-map');
        if (!map) return;

        if (DB.mapaCustomizado) {
            map.style.backgroundImage = `url('${DB.mapaCustomizado}')`;
            map.style.backgroundColor = '#ffffff';
            if (btnReset) btnReset.style.display = 'inline-flex';
        } else {
            map.style.backgroundImage = 'repeating-linear-gradient(45deg, #ffffff, #ffffff 20px, #f3e8ff 20px, #f3e8ff 40px)';
            if (btnReset) btnReset.style.display = 'none';
        }
        
        map.innerHTML = ""; 
        
        DB.blocos.forEach(bloco => {
            const qtdAtivos = DB.ativos.filter(a => a.bloco_id === bloco.id && a.posse_user_id === null).length;
            
            const pin = document.createElement('div');
            pin.className = 'map-pin';
            pin.style.left = `${bloco.coord_x}%`;
            pin.style.top = `${bloco.coord_y}%`;
            pin.innerText = qtdAtivos;
            
            const label = document.createElement('span');
            label.className = 'pin-label';
            label.innerText = `${bloco.nome}`;
            pin.appendChild(label);
            
            pin.onclick = () => alert(`Endereço da Planta: ${bloco.nome}\nReferência: ${bloco.endereco}\nEquipamentos parados neste local: ${qtdAtivos}`);
            
            map.appendChild(pin);
        });
    }
};

window.app = app;