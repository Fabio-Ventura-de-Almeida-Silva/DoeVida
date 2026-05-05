const campaigns = window.DoeVidaCampaigns || [];
const state = window.DoeVidaState || {};

/* ──────────────────────────────────────
           STATE
        ────────────────────────────────────── */

        /* ──────────────────────────────────────
           TABS
        ────────────────────────────────────── */
        function switchTab(id) {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('tab-' + id).classList.add('active');
            document.querySelector(`[data-tab="${id}"]`)?.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (id === 'map') setTimeout(initMap, 100);
        }
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        /* ──────────────────────────────────────
           RENDER CAMPAIGN FEED
        ────────────────────────────────────── */
        function calcularUrgencia(dataLimite) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const limite = new Date(dataLimite + 'T12:00:00');
            const diasRestantes = Math.ceil((limite - hoje) / 86400000);

            if (diasRestantes < 3) {
                return { nivel: 'urgente', label: '🔴 Urgente', dias: diasRestantes, peso: 1 };
            }
            if (diasRestantes <= 10) {
                return { nivel: 'medium', label: '🟡 Médio', dias: diasRestantes, peso: 2 };
            }
            return { nivel: 'low', label: '🟢 Baixa', dias: diasRestantes, peso: 3 };
        }

        function textoPrazo(dias) {
            if (dias < 0) return `prazo encerrado há ${Math.abs(dias)} dia(s)`;
            if (dias === 0) return 'prazo termina hoje';
            if (dias === 1) return 'prazo em 1 dia';
            return `prazo em ${dias} dias`;
        }

        function statusVerificacao(c) {
            if (c.tipo === 'institucional' || c.verificada) return 'Verificada';
            return 'Pendente de verificação';
        }

        function renderFeed() {
            const el = document.getElementById('feedPosts');
            const region = document.getElementById('filterRegion')?.value || '';
            const blood = document.getElementById('filterBlood')?.value || '';
            const filtered = campaigns.filter(c => {
                const matchRegion = !region || c.bairro === region || c.cidade === region;
                const matchBlood = !blood || c.blood === blood || c.blood === 'Todos';
                return matchRegion && matchBlood;
            });
            const ordered = [...filtered].sort((a, b) => {
                const ua = calcularUrgencia(a.dataLimite);
                const ub = calcularUrgencia(b.dataLimite);
                return ua.peso - ub.peso || new Date(a.dataLimite) - new Date(b.dataLimite);
            });

            if (!ordered.length) {
                el.innerHTML = `<div class="post-card"><div class="post-body">Nenhuma campanha encontrada para os filtros selecionados.</div></div>`;
                return;
            }

            el.innerHTML = ordered.map(c => {
                const urg = calcularUrgencia(c.dataLimite);
                const tipoLabel = c.tipo === 'pessoal' ? 'Campanha pessoal' : 'Campanha institucional';
                const initials = c.responsavel.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                return `
    <div class="post-card" id="pc-${c.id}">
      <div class="post-head">
        <div class="avatar-sm" style="background:${c.grad}">${initials || 'DV'}</div>
        <div class="post-meta">
          <div class="name">${c.titulo}</div>
          <div class="sub">${tipoLabel} · ${c.responsavel}</div>
        </div>
        <div class="campaign-status">${statusVerificacao(c)}</div>
      </div>

      <div class="campaign-tags">
        <span class="campaign-tag ${urg.nivel}">${urg.label} · ${textoPrazo(urg.dias)}</span>
        <span class="campaign-tag blood">🩸 ${c.blood}</span>
        <span class="campaign-tag">📍 ${c.bairro}, ${c.cidade}</span>
      </div>

      <div class="post-body">${c.descricao}</div>

      <div class="campaign-info-grid">
        <div class="campaign-info"><div class="label">Local de doação</div><div class="value">${c.local}</div></div>
        <div class="campaign-info"><div class="label">Data limite</div><div class="value">${new Date(c.dataLimite + 'T12:00').toLocaleDateString('pt-BR')}</div></div>
      </div>

      <div class="post-foot">
        <button class="post-btn post-btn-primary" onclick="openScheduleModal(${c.id})">Agendar doação</button>
        <button class="post-btn" onclick="openCampaignDetail(${c.id})">Ver campanha</button>
        <button class="post-btn" onclick="shareCampaign(${c.id})">Compartilhar</button>
      </div>
    </div>`;
            }).join('');
        }

        function clearCampaignFilters() {
            const region = document.getElementById('filterRegion');
            const blood = document.getElementById('filterBlood');
            if (region) region.value = '';
            if (blood) blood.value = '';
            renderFeed();
        }

        function interestCampaign(id) {
            const c = campaigns.find(x => x.id === id);
            if (!c) { toast('Campanha não encontrada.', true); return; }
            c.interessados += 1;
            trackCampaignEvent(id, 'interest_clicked');
            renderFeed();
            toast('Interesse registrado. Você pode iniciar o agendamento ou compartilhar a campanha.');
        }

        function sharePost(id) {
            shareCampaign(id);
        }

        /* ──────────────────────────────────────
           AUTH
        ────────────────────────────────────── */
        function doRegister() {
            const nome = document.getElementById('rNome').value.trim();
            const sobre = document.getElementById('rSobre').value.trim();
            const email = document.getElementById('rEmail').value.trim();
            const nasc = document.getElementById('rNasc').value;
            const peso = parseFloat(document.getElementById('rPeso').value);
            const senha = document.getElementById('rSenha').value;
            const sexo = document.getElementById('rSexo').value;
            const cpf = document.getElementById('rCpf').value.trim();
            const blood = document.querySelector('input[name=blood]:checked')?.value || '';

            if (!nome || !email || !nasc || !senha) { toast('⚠️ Preencha os campos obrigatórios', true); return; }
            if (senha.length < 8) { toast('⚠️ Senha precisa ter no mínimo 8 caracteres', true); return; }

            // Validate age
            const ageYrs = Math.floor((Date.now() - new Date(nasc)) / 31557600000);
            if (ageYrs < 16 || ageYrs > 69) { toast('⚠️ Idade deve ser entre 16 e 69 anos', true); return; }

            if (peso && peso < 50) { toast('⚠️ Peso mínimo para doação: 50kg', true); return; }

            state.user = { nome, sobre, email, cpf, nasc, peso, sexo, blood, initials: (nome[0] + (sobre?.[0] || '')).toUpperCase() };
            state.pts = 0;

            document.getElementById('regFormWrap').classList.add('hide');
            document.getElementById('regSuccess').classList.add('show');
            updateUI();
            renderFeed();
        }

        function doLogin() {
            const email = document.getElementById('lEmail').value.trim();
            const senha = document.getElementById('lSenha').value;
            if (!email || !senha) { toast('⚠️ Preencha e-mail e senha', true); return; }

            state.user = { nome: email.split('@')[0], sobre: '', email, initials: email[0].toUpperCase() };
            state.pts = state.pts || 0;
            closeModal('loginModal');
            toast('🎉 Login realizado! Bem-vindo(a) de volta.');
            updateUI();
            renderFeed();
        }

        function logout() {
            state.user = null; state.pts = 0; state.lastDona = null;
            updateUI();
            renderFeed();
            toast('Até logo! 👋');
        }

        function updateUI() {
            const ok = !!state.user;

            document.getElementById('authBtns').style.display = ok ? 'none' : 'flex';
            document.getElementById('userArea').classList.toggle('show', ok);
            document.getElementById('ptsBadge').classList.toggle('show', ok);
            document.getElementById('feedComposer').style.display = ok ? 'block' : 'none';
            const ptsCard = document.getElementById('ptsCard');
            if (ptsCard) ptsCard.style.display = ok ? 'block' : 'none';

            if (ok) {
                document.getElementById('navAvatar').textContent = state.user.initials;
                document.getElementById('navName').textContent = state.user.nome;
                document.getElementById('compAvatar').textContent = state.user.initials;
                document.getElementById('ptsVal').textContent = state.pts;
                if (document.getElementById('sidebarPts')) document.getElementById('sidebarPts').textContent = state.pts;
                updateProgress();
                updateWallet();
            }

            // Wallet visibility
            document.getElementById('walletLoggedOut').style.display = ok ? 'none' : 'block';
            document.getElementById('walletLoggedIn').style.display = ok ? 'block' : 'none';
        }

        function addPts(n) {
            state.pts += n;
            if (document.getElementById('ptsVal')) document.getElementById('ptsVal').textContent = state.pts;
            if (document.getElementById('sidebarPts')) document.getElementById('sidebarPts').textContent = state.pts;
            if (document.getElementById('wPts')) document.getElementById('wPts').textContent = state.pts;
            updateProgress();
            updateWalletLevel();
        }

        function currentTrackingRef(refOverride) {
            if (refOverride) return refOverride;
            const params = new URLSearchParams(window.location.search);
            return params.get('ref') || null;
        }

        function trackCampaignEvent(campaignId, eventName, refOverride) {
            const events = JSON.parse(localStorage.getItem('doevida_tracking_events') || '[]');
            events.push({
                campaignId: String(campaignId),
                ref: currentTrackingRef(refOverride),
                event: eventName,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('doevida_tracking_events', JSON.stringify(events));
        }

        function generateTrackableLink(campaignId) {
            const ref = state.user?.id || state.user?.email || state.user?.cpf || state.user?.initials || 'anon';
            const base = 'https://doevida.netlify.app/';
            const campaignParam = encodeURIComponent(String(campaignId));
            if (!state.user) return `${base}?campaign=${campaignParam}`;
            return `${base}?campaign=${campaignParam}&ref=${encodeURIComponent(ref)}`;
        }

        function shareCampaign(campaignId) {
            const link = generateTrackableLink(campaignId);
            trackCampaignEvent(campaignId, 'campaign_shared');
            const done = () => toast('Link da campanha copiado. As interações geradas por esse link poderão contar como mobilização qualificada.');
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(link).then(done).catch(() => {
                    window.prompt('Copie o link da campanha:', link);
                    done();
                });
            } else {
                window.prompt('Copie o link da campanha:', link);
                done();
            }
        }

        function openCampaignDetail(campaignId, options = {}) {
            const campaign = campaigns.find(c => String(c.id) === String(campaignId));
            if (!campaign) {
                toast('Campanha não encontrada.', true);
                switchTab('feed');
                return;
            }
            renderCampaignDetail(campaign);
            switchTab('campaign-detail');
            if (!options.skipPageView) trackCampaignEvent(campaign.id, 'campaign_page_view');
            trackCampaignEvent(campaign.id, 'campaign_main_info_viewed');
        }

        function renderCampaignDetail(c) {
            const el = document.getElementById('tab-campaign-detail');
            if (!el) return;
            const urg = calcularUrgencia(c.dataLimite);
            const tipoLabel = c.tipo === 'pessoal' ? 'Campanha pessoal' : 'Campanha institucional';
            const link = generateTrackableLink(c.id);
            el.innerHTML = `
    <div class="wrap">
      <section class="campaign-detail">
        <button class="btn btn-ghost btn-sm" onclick="switchTab('feed')">Voltar para campanhas</button>
        <div class="campaign-detail-hero">
          <div>
            <div class="campaign-tags">
              <span class="campaign-tag ${urg.nivel}">${urg.label} · ${textoPrazo(urg.dias)}</span>
              <span class="campaign-tag">${statusVerificacao(c)}</span>
              <span class="campaign-tag">${tipoLabel}</span>
            </div>
            <h2 class="sec-title">${c.titulo}</h2>
            <p class="sec-sub">${c.descricao}</p>
          </div>
        </div>

        <div class="campaign-detail-grid">
          <div class="campaign-detail-main">
            <h3>Sobre a campanha</h3>
            <p>${c.descricao}</p>
            <h3>Orientações para quem deseja doar</h3>
            <p>Confira os requisitos de aptidão, alimente-se bem, leve documento oficial com foto e confirme diretamente com o local responsável as orientações atualizadas antes de se deslocar.</p>
            <div class="campaign-flow">
              <div class="campaign-flow-step"><strong>1</strong><span>Acesso à campanha</span></div>
              <div class="campaign-flow-step"><strong>2</strong><span>Interesse sinalizado</span></div>
              <div class="campaign-flow-step"><strong>3</strong><span>Agendamento iniciado</span></div>
              <div class="campaign-flow-step"><strong>4</strong><span>Solicitação enviada</span></div>
            </div>
            <p class="points-notice">Esta campanha pode ser compartilhada por um link rastreável. As interações geradas ajudam a medir alcance, interesse e mobilização qualificada, sem gerar recompensa pela doação em si.</p>
          </div>

          <aside class="campaign-detail-side">
            <div class="campaign-info"><div class="label">Responsável</div><div class="value">${c.responsavel}</div></div>
            <div class="campaign-info"><div class="label">Instituição ou local vinculado</div><div class="value">${c.instituicao || c.local}</div></div>
            <div class="campaign-info"><div class="label">Tipo sanguíneo necessário</div><div class="value">${c.blood}</div></div>
            <div class="campaign-info"><div class="label">Doadores necessários</div><div class="value">${c.qtd}</div></div>
            <div class="campaign-info"><div class="label">Local de doação</div><div class="value">${c.local}</div></div>
            <div class="campaign-info"><div class="label">Cidade e bairro</div><div class="value">${c.cidade} · ${c.bairro}</div></div>
            <div class="campaign-info"><div class="label">Data limite</div><div class="value">${new Date(c.dataLimite + 'T12:00').toLocaleDateString('pt-BR')}</div></div>
            <div class="campaign-info"><div class="label">Contato</div><div class="value">${c.contato}</div></div>
            <div class="schedule-summary">
              <label>Link rastreável</label>
              <div>${link}</div>
            </div>
          </aside>
        </div>

        <div class="campaign-detail-actions">
          <button class="btn btn-red btn-lg" onclick="openScheduleModal(${c.id})">Agendar doação</button>
          <button class="btn btn-outline btn-lg" onclick="shareCampaign(${c.id})">Compartilhar campanha</button>
          <button class="btn btn-ghost btn-lg" onclick="switchTab('feed')">Voltar para campanhas</button>
        </div>
      </section>
    </div>`;
        }

        function handleCampaignUrlParams() {
            const params = new URLSearchParams(window.location.search);
            const campaignId = params.get('campaign');
            const ref = params.get('ref');
            if (!campaignId) return;
            const campaign = campaigns.find(c => String(c.id) === String(campaignId));
            if (!campaign) {
                toast('Campanha não encontrada.', true);
                switchTab('feed');
                return;
            }
            if (ref) trackCampaignEvent(campaignId, 'campaign_page_view', ref);
            openCampaignDetail(campaignId, { skipPageView: !!ref });
        }

        function updateProgress() {
            const next = state.pts >= 1500 ? 1500 : state.pts >= 700 ? 1500 : 300;
            const pct = Math.min((state.pts / next) * 100, 100);
            const el = document.getElementById('progFill');
            const lb = document.getElementById('progLbl');
            if (el) el.style.width = pct + '%';
            if (lb) lb.textContent = `${state.pts}/${next}`;
        }

        function updateWalletLevel() {
            const n = state.pts >= 1500 ? 'Ouro disponível' : state.pts >= 700 ? 'Prata disponível' : state.pts >= 300 ? 'Bronze disponível' : 'A desbloquear';
            const el = document.getElementById('wNivel');
            if (el) el.textContent = n;
        }

        /* ──────────────────────────────────────
           WALLET
        ────────────────────────────────────── */
        function updateWallet() {
            if (!state.user) return;
            const a = document.getElementById('wAvatar');
            if (a) a.textContent = state.user.initials;
            const n = document.getElementById('wName');
            if (n) n.textContent = state.user.nome + (state.user.sobre ? ' ' + state.user.sobre : '');
            const e = document.getElementById('wEmail');
            if (e) e.textContent = state.user.email;
            document.getElementById('wPts').textContent = state.pts;
            document.getElementById('wDoas').textContent = state.lastDona ? (document.getElementById('wDoas').textContent || '1') : '0';
            updateWalletLevel();

            const fields = document.getElementById('walletFields');
            if (fields) fields.innerHTML = `
    <div class="wfield"><label>CPF</label><div class="val">${state.user.cpf || '—'}</div></div>
    <div class="wfield"><label>Nascimento</label><div class="val">${state.user.nasc ? new Date(state.user.nasc + 'T12:00').toLocaleDateString('pt-BR') : '—'}</div></div>
    <div class="wfield"><label>Tipo Sanguíneo</label><div class="val blood">${state.user.blood || '—'}</div></div>
    <div class="wfield"><label>Peso</label><div class="val">${state.user.peso ? state.user.peso + ' kg' : '—'}</div></div>
    <div class="wfield"><label>Sexo</label><div class="val">${state.user.sexo === 'M' ? 'Masculino' : state.user.sexo === 'F' ? 'Feminino' : '—'}</div></div>
    <div class="wfield"><label>Benefício</label><div class="val" style="color:var(--g600)">${state.pts >= 1500 ? 'Ouro disponível' : state.pts >= 700 ? 'Prata disponível' : state.pts >= 300 ? 'Bronze disponível' : 'A desbloquear'}</div></div>`;

            updateDonaStatus();
        }

        function updateDonaStatus() {
            const el = document.getElementById('donaStatus');
            if (!el || !state.user) return;
            if (!state.lastDona) {
                el.className = 'dona-status none';
                el.innerHTML = `<div class="icon">💉</div><div class="info"><div class="title">Sem doações registradas</div><div class="sub">Registre sua primeira doação.</div></div>`;
                return;
            }
            const interval = state.user.sexo === 'F' ? 90 : 60;
            const diff = Math.floor((Date.now() - new Date(state.lastDona)) / 86400000);
            const rem = interval - diff;
            if (rem <= 0) {
                el.className = 'dona-status ok';
                el.innerHTML = `<div class="icon">✅</div><div class="info"><div class="title">Apto para doação</div><div class="sub">Última doação há ${diff} dias. Intervalo mínimo (${interval} dias) cumprido!</div></div>`;
            } else {
                el.className = 'dona-status wait';
                el.innerHTML = `<div class="icon">⏳</div><div class="info"><div class="title">Aguardando intervalo</div><div class="sub">Última doação há ${diff} dias. Pode doar novamente em <strong>${rem} dias</strong>.</div></div>`;
            }
        }
        function toggleWalletEdit() {
            state.walletEditOpen = !state.walletEditOpen;
            const f = document.getElementById('walletEditForm');
            f.classList.toggle('open', state.walletEditOpen);
            if (state.walletEditOpen) {
                f.innerHTML = `
      <div class="form-2col">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="eNome" value="${state.user.nome || ''}"/></div>
        <div class="form-group"><label class="form-label">Sobrenome</label><input class="form-input" id="eSobre" value="${state.user.sobre || ''}"/></div>
      </div>
      <div class="form-group"><label class="form-label">CPF</label><input class="form-input" id="eCpf" value="${state.user.cpf || ''}"/></div>
      <div class="form-group">
        <label class="form-label">Peso (kg)</label>
        <input type="number" class="form-input" id="ePeso" value="${state.user.peso || ''}" oninput="checkPesoEl(this)"/>
        <div class="weight-warn" id="ePesoWarn">⚠️ Peso mínimo para doação: 50 kg</div>
      </div>
      <button class="btn btn-green btn-sm" onclick="saveWallet()">Salvar</button>
      <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="toggleWalletEdit()">Cancelar</button>`;
            }
        }
        function saveWallet() {
            if (!state.user) return;
            const n = document.getElementById('eNome')?.value.trim();
            const s = document.getElementById('eSobre')?.value.trim();
            const p = parseFloat(document.getElementById('ePeso')?.value);
            const c = document.getElementById('eCpf')?.value.trim();
            if (p && p < 50) { toast('⚠️ Peso mínimo: 50kg', true); return; }
            state.user.nome = n || state.user.nome;
            state.user.sobre = s || state.user.sobre;
            state.user.peso = p || state.user.peso;
            state.user.cpf = c || state.user.cpf;
            state.user.initials = (state.user.nome[0] + (state.user.sobre?.[0] || '')).toUpperCase();
            state.walletEditOpen = false;
            document.getElementById('walletEditForm').classList.remove('open');
            updateWallet(); updateUI();
            toast('✅ Perfil atualizado!');
        }

        /* ──────────────────────────────────────
           DONATIONS
        ────────────────────────────────────── */
        function registerDonation() {
            if (!state.user) { closeModal('donationModal'); openModal('loginModal'); return; }
            const posto = document.getElementById('donaPosto').value;
            const data = document.getElementById('donaData').value;
            if (!posto || !data) { toast('⚠️ Preencha posto e data', true); return; }

            // Check interval (simulate)
            if (state.lastDona) {
                const interval = state.user.sexo === 'F' ? 90 : 60;
                const diff = Math.floor((Date.now() - new Date(state.lastDona)) / 86400000);
                if (diff < interval) {
                    toast(`⚠️ Intervalo mínimo: ${interval} dias. Faltam ${interval - diff} dias.`, true);
                    return;
                }
            }

            state.lastDona = data;
            const wDoas = document.getElementById('wDoas');
            if (wDoas) wDoas.textContent = parseInt(wDoas.textContent || 0) + 1;
            closeModal('donationModal');
            toast('Doação registrada no histórico pessoal.');
            updateDonaStatus();
        }

        function openScheduleModal(campaignId) {
            const campaign = campaigns.find(c => String(c.id) === String(campaignId));
            if (!campaign) { toast('Campanha não encontrada.', true); return; }
            state.scheduleCampaignId = campaign.id;
            const title = document.getElementById('scheduleCampaignTitle');
            const local = document.getElementById('scheduleLocation');
            if (title) title.textContent = campaign.titulo;
            if (local) local.value = campaign.local;
            trackCampaignEvent(campaign.id, 'schedule_started');
            openModal('scheduleModal');
        }

        function submitScheduleRequest() {
            const campaign = campaigns.find(c => String(c.id) === String(state.scheduleCampaignId));
            if (!campaign) { toast('Campanha não encontrada.', true); return; }
            const name = document.getElementById('scheduleName').value.trim();
            const contact = document.getElementById('scheduleContact').value.trim();
            const date = document.getElementById('scheduleDate').value;
            const time = document.getElementById('scheduleTime').value;
            const location = document.getElementById('scheduleLocation').value.trim();
            const notes = document.getElementById('scheduleNotes').value.trim();
            if (!name || !contact || !date || !time) {
                toast('⚠️ Preencha nome, contato, data e horário', true);
                return;
            }

            const requests = JSON.parse(localStorage.getItem('doevida_schedule_requests') || '[]');
            requests.push({
                campaignId: campaign.id,
                campaignTitle: campaign.titulo,
                name,
                contact,
                date,
                time,
                location,
                notes,
                ref: currentTrackingRef(),
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('doevida_schedule_requests', JSON.stringify(requests));
            trackCampaignEvent(campaign.id, 'schedule_submitted');
            ['scheduleName', 'scheduleContact', 'scheduleDate', 'scheduleTime', 'scheduleNotes'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            closeModal('scheduleModal');
            toast('Solicitação de agendamento registrada. A instituição responsável poderá confirmar as orientações da doação.');
        }

        /* ──────────────────────────────────────
           CAMPAIGN FORM
        ────────────────────────────────────── */
        function selType(btn) {
            document.querySelectorAll('.post-type').forEach(b => { b.classList.remove('btn-green'); b.classList.add('btn-ghost'); });
            btn.classList.remove('btn-ghost'); btn.classList.add('btn-green');
            state.selPostType = btn.dataset.type;
        }

        function submitPost() {
            if (!state.user) { closeModal('postModal'); openModal('loginModal'); return; }

            const titulo = document.getElementById('campTitulo').value.trim();
            const responsavel = document.getElementById('campResponsavel').value.trim();
            const blood = document.getElementById('campBlood').value;
            const dataLimite = document.getElementById('campDataLimite').value;
            const qtd = parseInt(document.getElementById('campQtd').value || '1', 10);
            const local = document.getElementById('campLocal').value.trim();
            const cidade = document.getElementById('campCidade').value.trim();
            const bairro = document.getElementById('campBairro').value.trim();
            const contato = document.getElementById('campContato').value.trim();
            const descricao = document.getElementById('postTxt').value.trim();

            if (!titulo || !responsavel || !blood || !dataLimite || !local || !cidade || !bairro || !contato || !descricao) {
                toast('⚠️ Preencha os campos principais da campanha', true);
                return;
            }

            campaigns.unshift({
                id: Date.now(),
                tipo: state.selPostType,
                titulo,
                responsavel,
                instituicao: responsavel,
                blood,
                cidade,
                bairro,
                local,
                dataLimite,
                qtd,
                contato,
                descricao,
                verificada: state.selPostType === 'institucional',
                interessados: 0,
                grad: state.selPostType === 'pessoal'
                    ? 'linear-gradient(135deg,#7C2D12,#C1121F)'
                    : 'linear-gradient(135deg,var(--g600),var(--g400))'
            });

            ['campTitulo', 'campResponsavel', 'campBlood', 'campDataLimite', 'campQtd', 'campLocal', 'campCidade', 'campBairro', 'campContato', 'postTxt']
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

            closeModal('postModal');
            renderFeed();
            toast('📣 Campanha publicada no feed.');
        }

        /* ──────────────────────────────────────
           MAP
        ────────────────────────────────────── */
        function initMap() {
            if (state.mapInited) return;
            state.mapInited = true;
            const m = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([-8.0476, -34.877], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(m);

            const mk = (emoji, color) => L.divIcon({
                className: '',
                html: `<div style="background:${color};color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px rgba(0,0,0,.25);border:3px solid white;">${emoji}</div>`,
                iconSize: [38, 38], iconAnchor: [19, 19]
            });

            const places = [
                { ll: [-8.0631, -34.8711], name: 'Hemope — Boa Vista', t: 'hemo', info: '<b>HEMOPE</b><br>R. Joaquim Nabuco, 185<br>☎ (81) 3184-7500<br>Seg–Sex: 7h–17h' },
                { ll: [-8.1129, -34.8931], name: 'Ihene — Boa Viagem', t: 'hemo', info: '<b>IHENE</b><br>Av. Domingos Ferreira, 4891<br>☎ (81) 3462-1234<br>Seg–Sáb: 7h–18h' },
                { ll: [-8.0571, -34.8825], name: 'IMIP', t: 'hosp', info: '<b>IMIP</b><br>R. dos Coelhos, 300<br>☎ (81) 2122-4100<br>24h' },
                { ll: [-8.0555, -34.9024], name: 'HC-UFPE', t: 'hosp', info: '<b>HC-UFPE</b><br>Av. Moraes Rego, s/n<br>☎ (81) 2126-3000' },
                { ll: [-8.0694, -34.8759], name: 'HUOC — UPE', t: 'hosp', info: '<b>HUOC — UPE</b><br>Av. Agamenon Magalhães, s/n<br>☎ (81) 3183-5000' },
                { ll: [-8.0900, -34.8930], name: 'Real Hospital Português', t: 'hosp', info: '<b>Real H. Português</b><br>Av. Agamenon Magalhães, 4760<br>24h' },
            ];

            places.forEach(p => {
                L.marker(p.ll, { icon: mk(p.t === 'hemo' ? '🩸' : '🏥', p.t === 'hemo' ? '#00796b' : '#e53935') })
                    .addTo(m).bindPopup(`<div style="font-family:'DM Sans',sans-serif;font-size:13px;line-height:1.6;">${p.info}</div>`, { maxWidth: 220 })
                    .bindTooltip(p.name, { direction: 'top' });
            });

            // User location (simulated — Recife center)
            L.marker([-8.0476, -34.877], { icon: mk('📍', '#3b82f6') })
                .addTo(m).bindPopup('<b>Sua localização</b>').bindTooltip('Você');
        }

        /* ──────────────────────────────────────
           MODALS
        ────────────────────────────────────── */
        function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
        function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }
        function closeOnBg(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }
        function swapModal(from, to) { closeModal(from); setTimeout(() => openModal(to), 200); }

        /* ──────────────────────────────────────
           VALIDATIONS
        ────────────────────────────────────── */
        function checkPeso(inp) {
            const v = parseFloat(inp.value);
            const w = document.getElementById('pesoWarn');
            if (v && v < 50) { inp.classList.add('err'); w.classList.add('show'); }
            else { inp.classList.remove('err'); w.classList.remove('show'); }
        }
        function checkPesoEl(inp) {
            const v = parseFloat(inp.value);
            const w = document.getElementById('ePesoWarn');
            if (v && v < 50) { inp.classList.add('err'); if (w) w.classList.add('show'); }
            else { inp.classList.remove('err'); if (w) w.classList.remove('show'); }
        }
        function maskCpf(inp) {
            let v = inp.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
            else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
            inp.value = v;
        }

        /* ──────────────────────────────────────
           TOAST
        ────────────────────────────────────── */
        function toast(msg, isErr = false) {
            const box = document.getElementById('toastBox');
            const t = document.createElement('div');
            t.className = `toast${isErr ? ' err' : ''}`;
            t.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${isErr ? 'var(--red)' : 'var(--g600)'};flex-shrink:0;"></div>${msg}`;
            box.appendChild(t);
            setTimeout(() => { t.style.animation = 'tOut .4s ease forwards'; setTimeout(() => t.remove(), 400); }, 3500);
        }

        /* ──────────────────────────────────────
           VOUCHER COPY
        ────────────────────────────────────── */
        function copyCode(el, code) {
            navigator.clipboard.writeText(code).catch(() => { });
            const orig = el.innerHTML;
            el.innerHTML = '✅ Copiado!';
            setTimeout(() => { el.innerHTML = orig; }, 2000);
            toast('📋 Código copiado!');
        }

        /* ──────────────────────────────────────
           PARTNER CALL
        ────────────────────────────────────── */
        function callPartner() {
            toast('📞 Ligando para (81) 99277-8821…');
            setTimeout(() => window.open('tel:+5581992778821'), 800);
        }

        /* ──────────────────────────────────────
           INIT
        ────────────────────────────────────── */
        document.addEventListener('DOMContentLoaded', () => {
            renderFeed();
            handleCampaignUrlParams();
            // Set today's date as default for donation form
            const today = new Date().toISOString().split('T')[0];
            const donaDataEl = document.getElementById('donaData');
            if (donaDataEl) { donaDataEl.value = today; donaDataEl.max = today; }
            const scheduleDateEl = document.getElementById('scheduleDate');
            if (scheduleDateEl) { scheduleDateEl.min = today; }
        });


Object.assign(window, {
  switchTab,
  interestCampaign,
  sharePost,
  openCampaignDetail,
  renderCampaignDetail,
  shareCampaign,
  generateTrackableLink,
  trackCampaignEvent,
  openScheduleModal,
  submitScheduleRequest,
  clearCampaignFilters,
  doRegister,
  doLogin,
  logout,
  toggleWalletEdit,
  saveWallet,
  registerDonation,
  selType,
  submitPost,
  openModal,
  closeModal,
  closeOnBg,
  swapModal,
  checkPeso,
  checkPesoEl,
  maskCpf,
  copyCode,
  callPartner
});
