import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';

// ─────────────────────────────────────────────
// FIREBASE CONFIG
// ─────────────────────────────────────────────
const API_KEY    = "AIzaSyDA-EfIgc_Ai283VuJHgo86gC3YWovn7pw";
const PROJECT_ID = "projeto-android-756a1";
const AUTH_URL   = `https://identitytoolkit.googleapis.com/v1/accounts`;
const DB_URL     = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ─────────────────────────────────────────────
// CORES
// ─────────────────────────────────────────────
const COR = {
  laranja:    '#C97B2A',
  laranjaEsc: '#B5651D',
  laranjaClr: '#E8A04A',
  marrom:     '#2C1A0E',
  fundo:      '#f7f0e8',
  card:       '#fff',
  verde:      '#16a34a',
  verdeClr:   '#dcfce7',
  verdeBorda: '#86efac',
  azul:       '#1d4ed8',
  azulClr:    '#dbeafe',
  azulBorda:  '#93c5fd',
};

// ─────────────────────────────────────────────
// HELPERS FIRESTORE
// ─────────────────────────────────────────────
const toFirestore = (obj) => {
  const fields = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === 'string')      fields[key] = { stringValue: val };
    else if (typeof val === 'number') fields[key] = { doubleValue: val };
    else if (val instanceof Date)     fields[key] = { timestampValue: val.toISOString() };
  }
  return { fields };
};

const fromFirestore = (doc) => {
  const result = { id: doc.name.split('/').pop() };
  for (const key in doc.fields) {
    const f = doc.fields[key];
    result[key] =
      f.stringValue   ??
      f.doubleValue   ??
      f.integerValue  ??
      f.timestampValue ??
      null;
  }
  return result;
};

// ─────────────────────────────────────────────
// AUTH SERVICE
// ─────────────────────────────────────────────
const AuthService = {
  currentUser: null,

  _validarSenha(senha) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).*$/;
    return regex.test(senha);
  },

  async register(email, senha) {
    try {
      const res = await fetch(`${AUTH_URL}:signUp?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: 'Erro de conexão. Verifique sua internet.' };
    }
  },

  async login(email, senha) {
    try {
      const res = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) return { ok: false, erro: data.error.message };
      this.currentUser = {
        id:           data.localId,
        email:        data.email,
        token:        data.idToken,
        refreshToken: data.refreshToken,
      };
      return { ok: true, user: this.currentUser };
    } catch (e) {
      return { ok: false, erro: 'Erro de conexão. Verifique sua internet.' };
    }
  },

  async renovarToken(refreshToken) {
    try {
      const res = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
        }
      );
      const data = await res.json();
      if (data.error) return null;
      return data.id_token;
    } catch (e) {
      return null;
    }
  },

  logout() {
    this.currentUser = null;
  },
};

// ─────────────────────────────────────────────
// PRODUTO SERVICE
// ─────────────────────────────────────────────
const ProdutoService = {
  async salvar(userId, token, produto) {
    try {
      const res = await fetch(`${DB_URL}/produtos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(toFirestore({
          userId,
          nome:        produto.nome        || '',
          descricao:   produto.descricao   || '',
          material:    produto.material    || '',
          largura:     produto.largura     || '',
          comprimento: produto.comprimento || '',
          precoUnit:   parseFloat(produto.precoUnit) || 0,
          criadoEm:    new Date(),
        })),
      });
      const data = await res.json();
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: 'Erro de conexão ao salvar.' };
    }
  },

  async listar(userId, token) {
    try {
      const res = await fetch(`${DB_URL}/produtos?pageSize=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error || !data.documents) return [];
      return data.documents
        .map(fromFirestore)
        .filter((p) => p.userId === userId)
        .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    } catch (e) {
      return [];
    }
  },

  async atualizar(id, token, produto) {
    try {
      const campos = Object.keys(produto).join(',');
      const res = await fetch(
        `${DB_URL}/produtos/${id}?updateMask.fieldPaths=${campos}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(toFirestore(produto)),
        }
      );
      const data = await res.json();
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: 'Erro ao atualizar.' };
    }
  },

  async deletar(id, token) {
    try {
      const res = await fetch(`${DB_URL}/produtos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 200 || res.status === 204) return { ok: true };
      const data = await res.json();
      return { ok: false, erro: data.error?.message || 'Erro ao excluir' };
    } catch (e) {
      return { ok: false, erro: 'Erro de conexão ao excluir.' };
    }
  },
};

// ─────────────────────────────────────────────
// ORÇAMENTO SERVICE
// ─────────────────────────────────────────────
const OrcService = {
  async salvar(userId, token, orc) {
    try {
      const res = await fetch(`${DB_URL}/orcamentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(toFirestore({
          userId,
          largura:     orc.largura     || '',
          altura: orc.altura || '',
          material:    orc.material    || '',
          precoUnit:   parseFloat(orc.precoUnit)   || 0,
          total:       parseFloat(orc.total)        || 0,
          criadoEm:    new Date(),
        })),
      });
      const data = await res.json();
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: 'Erro de conexão ao salvar.' };
    }
  },

  async listar(userId, token) {
    try {
      const res = await fetch(`${DB_URL}/orcamentos?pageSize=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error || !data.documents) return [];
      return data.documents
        .map(fromFirestore)
        .filter((o) => o.userId === userId)
        .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    } catch (e) {
      return [];
    }
  },

  async deletar(id, token) {
    try {
      const res = await fetch(`${DB_URL}/orcamentos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 200 || res.status === 204) return { ok: true };
      const data = await res.json();
      return { ok: false, erro: data.error?.message || 'Erro ao excluir' };
    } catch (e) {
      return { ok: false, erro: 'Erro de conexão ao excluir.' };
    }
  },
};

// ─────────────────────────────────────────────
// COMPONENTE: TOAST
// ─────────────────────────────────────────────
function Toast({ mensagem, tipo = 'sucesso', aoEsconder }) {
  const opacidade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacidade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacidade, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => { if (aoEsconder) aoEsconder(); });
  }, []);

  const bg    = tipo === 'sucesso' ? '#15803d' : '#b91c1c';
  const icone = tipo === 'sucesso' ? '✓  '     : '⚠  ';

  return (
    <Animated.View style={[st.toast, { backgroundColor: bg, opacity: opacidade }]}>
      <Text style={st.toastTexto}>{icone}{mensagem}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: MODAL CONFIRMAR
// ─────────────────────────────────────────────
function ModalConfirmar({ visivel, mensagem, aoConfirmar, aoCancelar }) {
  return (
    <Modal transparent animationType="fade" visible={visivel} onRequestClose={aoCancelar}>
      <View style={st.overlay}>
        <View style={st.confirmBox}>
          <Text style={st.confirmTitulo}>Confirmar exclusão</Text>
          <Text style={st.confirmMsg}>{mensagem}</Text>
          <View style={st.confirmBtns}>
            <TouchableOpacity style={st.btnCancelar} onPress={aoCancelar} activeOpacity={0.8}>
              <Text style={st.btnCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.btnExcluir} onPress={aoConfirmar} activeOpacity={0.8}>
              <Text style={st.btnExcluirTexto}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: MODAL ENVIAR ORÇAMENTO
// ─────────────────────────────────────────────
function ModalEnviar({ visivel, item, remetente, aoFechar, aoToast }) {
  const [telefone, setTelefone]             = useState('');
  const [email, setEmail]                   = useState('');
  const [enviando, setEnviando]             = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState('whatsapp');

  const fmtValor = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',');
  const fmtData  = (iso) => new Date(iso).toLocaleDateString('pt-BR');

  const limparEFechar = () => {
    setTelefone('');
    setEmail('');
    setAbaSelecionada('whatsapp');
    aoFechar();
  };

  const aoMudarTelefone = (texto) => setTelefone(texto.replace(/\D/g, ''));

  const telefoneFormatado = () => {
    const d = telefone;
    if (d.length <= 2)  return d.length ? '(' + d : '';
    if (d.length <= 6)  return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7, 11);
  };

  const gerarMensagem = () => {
    const linhas = [
      '🏷️ *Orçamento de Etiquetas*',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      item.material    ? '🧾 *Material:*    ' + item.material    : null,
      item.largura     ? '↔️ *Largura:*     ' + item.largura     : null,
      item.comprimento ? '↕️ *Altura:* ' + item.altura : null,
      '💲 *Preço unit.:* ' + fmtValor(item.precoUnit),
      '━━━━━━━━━━━━━━━━━━━━━',
      '💰 *TOTAL: ' + fmtValor(item.total) + '*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '',
      '📅 Data: ' + fmtData(item.criadoEm),
      '',
      '_Atenciosamente,_',
      '_' + remetente + '_',
    ].filter((l) => l !== null);
    return linhas.join('\n');
  };

  const enviarWhatsApp = async () => {
    if (telefone.length < 10) {
      aoToast('Informe um número com DDD (mínimo 10 dígitos)', 'erro');
      return;
    }
    setEnviando(true);
    const numeroIntl  = '55' + telefone;
    const mensagem    = encodeURIComponent(gerarMensagem());
    const url         = 'whatsapp://send?phone=' + numeroIntl + '&text=' + mensagem;
    const urlFallback = 'https://wa.me/' + numeroIntl + '?text=' + mensagem;
    try {
      const podeNativo = await Linking.canOpenURL(url);
      await Linking.openURL(podeNativo ? url : urlFallback);
      aoToast('WhatsApp aberto com o orçamento!');
      limparEFechar();
    } catch (e) {
      aoToast('Erro ao abrir WhatsApp', 'erro');
    } finally {
      setEnviando(false);
    }
  };

  const enviarEmail = async () => {
    if (!email.trim()) {
      aoToast('Informe um e-mail válido', 'erro');
      return;
    }
    setEnviando(true);
    const assunto  = encodeURIComponent('Orçamento de Etiquetas');
    const corpo    = encodeURIComponent(gerarMensagem());
    const urlEmail = 'mailto:' + email + '?subject=' + assunto + '&body=' + corpo;
    try {
      await Linking.openURL(urlEmail);
      aoToast('E-mail aberto com o orçamento!');
      limparEFechar();
    } catch (e) {
      aoToast('Erro ao abrir e-mail', 'erro');
    } finally {
      setEnviando(false);
    }
  };

  if (!item) return null;

  return (
    <Modal transparent animationType="slide" visible={visivel} onRequestClose={limparEFechar}>
      <View style={st.overlay}>
        <View style={st.enviarBox}>
          <View style={st.enviarHeader}>
            <Text style={st.enviarTitulo}>📤 Enviar Orçamento</Text>
            <TouchableOpacity onPress={limparEFechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={st.enviarFechar}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={st.abas}>
            <TouchableOpacity
              style={[st.abaBtn, abaSelecionada === 'whatsapp' && st.abaBtnAtiva]}
              onPress={() => setAbaSelecionada('whatsapp')}
              activeOpacity={0.8}>
              <Text style={[st.abaBtnTexto, abaSelecionada === 'whatsapp' && st.abaBtnTextoAtiva]}>
                💬 WhatsApp
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.abaBtn, abaSelecionada === 'email' && st.abaBtnAtiva]}
              onPress={() => setAbaSelecionada('email')}
              activeOpacity={0.8}>
              <Text style={[st.abaBtnTexto, abaSelecionada === 'email' && st.abaBtnTextoAtiva]}>
                ✉️ E-mail
              </Text>
            </TouchableOpacity>
          </View>

          <View style={st.enviarResumo}>
            <View style={st.enviarResumoLinha}>
              <Text style={st.enviarResumoLabel}>Total</Text>
              <Text style={st.enviarResumoTotal}>{fmtValor(item.total)}</Text>
            </View>
            <Text style={st.enviarResumoDetalhe}>
              {item.quantidade} un × {fmtValor(item.precoUnit)}
              {item.material    ? '  •  ' + item.material    : ''}
              {item.largura     ? '  •  ' + item.largura     : ''}
              {item.comprimento ? '  •  ' + item.comprimento : ''}
            </Text>
          </View>

          {abaSelecionada === 'whatsapp' && (
            <>
              <Text style={st.enviarCampoLabel}>WhatsApp do cliente (com DDD)</Text>
              <View style={st.campoLinha}>
                <Text style={st.telPrefixo}>🇧🇷 +55</Text>
                <TextInput
                  style={[st.input, { flex: 1 }]}
                  value={telefoneFormatado()}
                  onChangeText={aoMudarTelefone}
                  placeholder="(11) 91234-5678"
                  placeholderTextColor="#b08060"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={16}
                />
              </View>
              <Text style={st.enviarDica}>
                O WhatsApp será aberto com o orçamento formatado e pronto para enviar.
              </Text>
            </>
          )}

          {abaSelecionada === 'email' && (
            <>
              <Text style={st.enviarCampoLabel}>E-mail do cliente</Text>
              <View style={st.campoLinha}>
                <TextInput
                  style={[st.input, { flex: 1 }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="cliente@email.com"
                  placeholderTextColor="#b08060"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={st.enviarDica}>
                O aplicativo de e-mail será aberto com o orçamento já preenchido e pronto para enviar.
              </Text>
            </>
          )}

          <View style={st.confirmBtns}>
            <TouchableOpacity style={st.btnCancelar} onPress={limparEFechar} activeOpacity={0.8}>
              <Text style={st.btnCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.btnEnviar, enviando && st.btnDesabilitado]}
              onPress={abaSelecionada === 'whatsapp' ? enviarWhatsApp : enviarEmail}
              disabled={enviando}
              activeOpacity={0.85}>
              {enviando
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.btnEnviarTexto}>
                    {abaSelecionada === 'whatsapp' ? 'Enviar  💬' : 'Enviar  ✉️'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: INDICADOR DE FORÇA DE SENHA
// ─────────────────────────────────────────────
function IndicadorForcaSenha({ senha, mostrarRequisitos = false }) {
  const temMinuscula = /[a-z]/.test(senha);
  const temMaiuscula = /[A-Z]/.test(senha);
  const temNumero    = /[0-9]/.test(senha);
  const temEspecial  = /[!@#$%^&*]/.test(senha);

  if (!mostrarRequisitos) return null;

  const Requisito = ({ atendido, texto }) => (
    <View style={st.requisitoLinha}>
      <Text style={{ fontSize: 12, marginRight: 8 }}>{atendido ? '✓' : '○'}</Text>
      <Text style={[st.requisitoTexto, atendido ? st.requisitoAtendido : st.requisitoNaoAtendido]}>
        {texto}
      </Text>
    </View>
  );

  return (
    <View style={st.requisitoBox}>
      <Requisito atendido={senha.length >= 8} texto="Mínimo 8 caracteres" />
      <Requisito atendido={temMaiuscula}       texto="Letra maiúscula (A-Z)" />
      <Requisito atendido={temMinuscula}       texto="Letra minúscula (a-z)" />
      <Requisito atendido={temNumero}          texto="Número (0-9)" />
      <Requisito atendido={temEspecial}        texto="Caractere especial (!@#$%^&*)" />
    </View>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: CAMPO DE INPUT
// ─────────────────────────────────────────────
function Campo({ label, valor, aoMudar, placeholder, teclado = 'default', senha = false, iconeDir }) {
  return (
    <View style={st.campoWrap}>
      {!!label && <Text style={st.campoLabel}>{label}</Text>}
      <View style={st.campoLinha}>
        <TextInput
          style={[st.input, iconeDir ? { paddingRight: 50 } : null]}
          value={valor}
          onChangeText={aoMudar}
          placeholder={placeholder}
          placeholderTextColor="#b08060"
          keyboardType={teclado}
          secureTextEntry={senha}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {iconeDir && <View style={st.campoDirWrap}>{iconeDir}</View>}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: BARRA DE NAVEGAÇÃO INFERIOR
// ─────────────────────────────────────────────
function NavBar({ telaAtiva, aoMudarTela }) {
  const abas = [
    { id: 'orcamentos', icone: '🏷️', label: 'Orçamentos' },
    { id: 'produtos',   icone: '📦', label: 'Produtos'   },
  ];

  return (
    <View style={st.navBar}>
      {abas.map((aba) => (
        <TouchableOpacity
          key={aba.id}
          style={[st.navItem, telaAtiva === aba.id && st.navItemAtivo]}
          onPress={() => aoMudarTela(aba.id)}
          activeOpacity={0.8}>
          <Text style={st.navIcone}>{aba.icone}</Text>
          <Text style={[st.navLabel, telaAtiva === aba.id && st.navLabelAtivo]}>
            {aba.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// TELA DE LOGIN / CADASTRO
// ─────────────────────────────────────────────
function TelaLogin({ aoLogar }) {
  const [modoLogin, setModoLogin]               = useState(true);
  const [email, setEmail]                       = useState('');
  const [confirmEmail, setConfirmEmail]         = useState('');
  const [senha, setSenha]                       = useState('');
  const [confirmSenha, setConfirmSenha]         = useState('');
  const [mostrarSenha, setMostrarSenha]         = useState(false);
  const [mostrarConfSenha, setMostrarConfSenha] = useState(false);
  const [carregando, setCarregando]             = useState(false);
  const [erroMsg, setErroMsg]                   = useState('');
  const [okMsg, setOkMsg]                       = useState('');

  const trocarModo = (paraLogin) => {
    setModoLogin(paraLogin);
    setErroMsg('');
    setOkMsg('');
    setEmail('');
    setSenha('');
    setConfirmEmail('');
    setConfirmSenha('');
    setMostrarSenha(false);
    setMostrarConfSenha(false);
  };

  const enviar = async () => {
    setErroMsg('');
    setOkMsg('');

    if (!email.trim() || !senha.trim()) {
      setErroMsg('Preencha todos os campos obrigatórios');
      return;
    }
    if (senha.length < 8) {
      setErroMsg('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (!modoLogin && !AuthService._validarSenha(senha)) {
      setErroMsg('A senha deve conter: maiúscula, minúscula, número e caractere especial (!@#$%^&*)');
      return;
    }

    setCarregando(true);
    try {
      if (!modoLogin) {
        if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
          setErroMsg('Os e-mails não coincidem');
          return;
        }
        if (senha !== confirmSenha) {
          setErroMsg('As senhas não coincidem');
          return;
        }
        const res = await AuthService.register(email, senha);
        if (res.ok) {
          setOkMsg('Conta criada com sucesso! Faça login.');
          trocarModo(true);
        } else {
          setErroMsg(res.erro);
        }
      } else {
        const res = await AuthService.login(email, senha);
        if (res.ok) {
          aoLogar(res.user);
        } else {
          setErroMsg(res.erro);
        }
      }
    } catch (e) {
      setErroMsg('Erro inesperado. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const BotaoOlho = ({ mostrar, aoAlternar }) => (
    <TouchableOpacity onPress={aoAlternar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Text style={{ fontSize: 18 }}>{mostrar ? '🙈' : '👁️'}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={st.loginSafe}>
      <StatusBar barStyle="light-content" backgroundColor={COR.laranjaEsc} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={st.loginScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <View style={st.logoArea}>
            <View style={st.logoBox}>
              <Text style={st.logoEmoji}>🏷️</Text>
            </View>
            <Text style={st.appTitulo}>EtiquetaFácil</Text>
            <Text style={st.appSub}>Orçamentos de etiquetas</Text>
          </View>

          <View style={st.loginCard}>
            <View style={st.tabs}>
              <TouchableOpacity
                style={[st.tabBtn, modoLogin && st.tabBtnAtivo]}
                onPress={() => trocarModo(true)}
                activeOpacity={0.8}>
                <Text style={[st.tabBtnTexto, modoLogin && st.tabBtnTextoAtivo]}>Entrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.tabBtn, !modoLogin && st.tabBtnAtivo]}
                onPress={() => trocarModo(false)}
                activeOpacity={0.8}>
                <Text style={[st.tabBtnTexto, !modoLogin && st.tabBtnTextoAtivo]}>Cadastrar</Text>
              </TouchableOpacity>
            </View>

            {!!erroMsg && (
              <View style={st.erroBox}>
                <Text style={st.erroTexto}>⚠ {erroMsg}</Text>
              </View>
            )}
            {!!okMsg && (
              <View style={st.okBox}>
                <Text style={st.okTexto}>✓ {okMsg}</Text>
              </View>
            )}

            <Campo label="E-mail" valor={email} aoMudar={setEmail} placeholder="seu@email.com" teclado="email-address" />

            {!modoLogin && (
              <Campo label="Confirmar e-mail" valor={confirmEmail} aoMudar={setConfirmEmail} placeholder="repita o e-mail" teclado="email-address" />
            )}

            <Campo
              label="Senha"
              valor={senha}
              aoMudar={setSenha}
              placeholder={modoLogin ? 'senha' : 'mínimo 8 caracteres'}
              senha={!mostrarSenha}
              iconeDir={<BotaoOlho mostrar={mostrarSenha} aoAlternar={() => setMostrarSenha((v) => !v)} />}
            />

            {!modoLogin && <IndicadorForcaSenha senha={senha} mostrarRequisitos={true} />}

            {!modoLogin && (
              <Campo
                label="Confirmar senha"
                valor={confirmSenha}
                aoMudar={setConfirmSenha}
                placeholder="repita a senha"
                senha={!mostrarConfSenha}
                iconeDir={<BotaoOlho mostrar={mostrarConfSenha} aoAlternar={() => setMostrarConfSenha((v) => !v)} />}
              />
            )}

            <TouchableOpacity
              style={[st.btnPrimario, carregando && st.btnDesabilitado]}
              onPress={enviar}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando
                ? <ActivityIndicator color="#fff" />
                : <Text style={st.btnPrimarioTexto}>{modoLogin ? 'ENTRAR' : 'CRIAR CONTA'}</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// TELA DE ORÇAMENTOS
// ─────────────────────────────────────────────
const ORC_VAZIO = {
  material: '', largura: '', altura: '',
  precoUnit: '', total: '0,00',
};

function TelaOrcamentos({ user }) {
  const [form, setForm]             = useState(ORC_VAZIO);
  const [lista, setLista]           = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [toast, setToast]           = useState(null);
  const [confirmar, setConfirmar]   = useState(null);
  const [enviarItem, setEnviarItem] = useState(null);

  useEffect(() => { carregarLista(); }, []);

  const carregarLista = async () => {
    const items = await OrcService.listar(user.id, user.token);
    setLista(items);
  };

  const exibirToast = (mensagem, tipo = 'sucesso') => setToast({ mensagem, tipo });

  const atualizarCampo = (campo, valor) => {
    setForm((prev) => {
      const novo  = { ...prev, [campo]: valor };

      const largura   = parseFloat(novo.largura.replace(',', '.')) || 0;
      const preco = parseFloat(novo.precoUnit.replace(',', '.'))  || 0;
      const altura = pareseFloat(String(novo.altura).replace(',','.')) || 0;

      const metragem = (largura * altura) / 1000;
      const total = metragem * preco;

      novo.total = total.toFixed(2).replace('.',',');
      
      return novo;
    });
  };

  const salvar = async () => {
    if (!form.largura || !form.altura || !form.precoUnit) {
      exibirToast('Informe largura, altura e preço unitário', 'erro');
      return;
    }
    setCarregando(true);
    try {
      const res = await OrcService.salvar(user.id, user.token, {
        ...form,
        total: parseFloat(form.total.replace(',', '.')) || 0,
      });
      if (res.ok) {
        exibirToast('Orçamento salvo com sucesso!');
        setForm(ORC_VAZIO);
        await carregarLista();
      } else {
        exibirToast(res.erro, 'erro');
      }
    } catch (e) {
      exibirToast('Erro ao salvar orçamento', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  const pedirDelecao = (id) => {
    setConfirmar({
      mensagem: 'Deseja realmente excluir este orçamento?',
      aoConfirmar: async () => {
        setConfirmar(null);
        const res = await OrcService.deletar(id, user.token);
        if (res.ok) {
          exibirToast('Orçamento excluído');
          await carregarLista();
        } else {
          exibirToast(res.erro, 'erro');
        }
      },
    });
  };

  const formatarData  = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatarValor = (n)   => Number(n).toFixed(2).replace('.', ',');

  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={st.mainScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={st.secaoTitulo}>Novo Orçamento</Text>
          <View style={st.formCard}>
            <Campo label="Material" valor={form.material} aoMudar={(v) => atualizarCampo('material', v)} placeholder="ex: BOPP" />
            <View style={st.linha2}>
              <View style={{ flex: 1 }}>
                <Campo label="Largura" valor={form.largura} aoMudar={(v) => atualizarCampo('largura', v)} placeholder="ex: 10cm" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Campo label="Alura" valor={form.altura} aoMudar={(v) => atualizarCampo('altura', v)} placeholder="ex: 5cm" />
              </View>
            </View>
            <View style={st.linha2}>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Campo label="Preço Unitário (R$)" valor={form.precoUnit} aoMudar={(v) => atualizarCampo('precoUnit', v)} placeholder="ex: 0.25" teclado="numeric" />
              </View>
            </View>
            <View style={st.totalBox}>
              <Text style={st.totalLabel}>Total</Text>
              <Text style={st.totalValor}>R$ {form.total}</Text>
            </View>
            <TouchableOpacity
              style={[st.btnSalvar, carregando && st.btnDesabilitado]}
              onPress={salvar}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando
                ? <ActivityIndicator color="#fff" />
                : <Text style={st.btnSalvarTexto}>💾 SALVAR ORÇAMENTO</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={st.listaHeader}>
            <Text style={st.secaoTitulo}>Orçamentos Salvos</Text>
            <View style={st.contadorBadge}>
              <Text style={st.contadorTexto}>{lista.length}</Text>
            </View>
          </View>

          {lista.length === 0 ? (
            <View style={st.estadoVazio}>
              <Text style={st.estadoVazioIcone}>📋</Text>
              <Text style={st.estadoVazioTexto}>Nenhum orçamento salvo ainda</Text>
            </View>
          ) : (
            lista.map((item) => (
              <View key={item.id} style={st.itemCard}>
                <View style={st.itemInfo}>
                  <Text style={st.itemTotal}>R$ {formatarValor(item.total)}</Text>
                  {!!item.material    && <Text style={st.itemLinha}>🧾 {item.material}</Text>}
                  {!!item.largura     && <Text style={st.itemLinha}>↔️ Largura: {item.largura}</Text>}
                  {!!item.comprimento && <Text style={st.itemLinha}>↕️ Altura: {item.altura}</Text>}
                  <Text style={st.itemData}>{formatarData(item.criadoEm)}</Text>
                </View>
                <View style={st.itemAcoes}>
                  <TouchableOpacity style={st.btnEnviarCard} onPress={() => setEnviarItem(item)} activeOpacity={0.75}>
                    <Text style={st.btnEnviarCardIcone}>✉</Text>
                    <Text style={st.btnEnviarCardTexto}>Enviar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.btnDeletar} onPress={() => pedirDelecao(item.id)} activeOpacity={0.7}>
                    <Text style={st.btnDeletarTexto}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {!!toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} aoEsconder={() => setToast(null)} />}
      <ModalConfirmar
        visivel={!!confirmar}
        mensagem={confirmar ? confirmar.mensagem : ''}
        aoConfirmar={confirmar ? confirmar.aoConfirmar : () => {}}
        aoCancelar={() => setConfirmar(null)}
      />
      <ModalEnviar
        visivel={!!enviarItem}
        item={enviarItem}
        remetente={user.email}
        aoFechar={() => setEnviarItem(null)}
        aoToast={exibirToast}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// TELA DE PRODUTOS
// ─────────────────────────────────────────────
const PROD_VAZIO = {
  nome: '', descricao: '', material: '',
  largura: '', comprimento: '', precoUnit: '',
};

function TelaProdutos({ user }) {
  const [form, setForm]             = useState(PROD_VAZIO);
  const [lista, setLista]           = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [toast, setToast]           = useState(null);
  const [confirmar, setConfirmar]   = useState(null);

  useEffect(() => { carregarLista(); }, []);

  const carregarLista = async () => {
    const items = await ProdutoService.listar(user.id, user.token);
    setLista(items);
  };

  const exibirToast = (mensagem, tipo = 'sucesso') => setToast({ mensagem, tipo });

  const atualizarCampo = (campo, valor) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const salvar = async () => {
    if (!form.nome || !form.precoUnit) {
      exibirToast('Informe nome e preço unitário', 'erro');
      return;
    }
    setCarregando(true);
    try {
      let res;
      if (editandoId) {
        res = await ProdutoService.atualizar(editandoId, user.token, {
          nome:        form.nome,
          descricao:   form.descricao,
          material:    form.material,
          largura:     form.largura,
          comprimento: form.comprimento,
          precoUnit:   parseFloat(form.precoUnit) || 0,
        });
      } else {
        res = await ProdutoService.salvar(user.id, user.token, form);
      }
      if (res.ok) {
        exibirToast(editandoId ? 'Produto atualizado!' : 'Produto cadastrado!');
        setForm(PROD_VAZIO);
        setEditandoId(null);
        await carregarLista();
      } else {
        exibirToast(res.erro, 'erro');
      }
    } catch (e) {
      exibirToast('Erro inesperado', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  const editar = (item) => {
    setForm({
      nome:        item.nome        || '',
      descricao:   item.descricao   || '',
      material:    item.material    || '',
      largura:     item.largura     || '',
      comprimento: item.comprimento || '',
      precoUnit:   String(item.precoUnit || ''),
    });
    setEditandoId(item.id);
  };

  const cancelarEdicao = () => {
    setForm(PROD_VAZIO);
    setEditandoId(null);
  };

  const pedirDelecao = (id) => {
    setConfirmar({
      mensagem: 'Deseja realmente excluir este produto?',
      aoConfirmar: async () => {
        setConfirmar(null);
        const res = await ProdutoService.deletar(id, user.token);
        if (res.ok) {
          exibirToast('Produto excluído');
          await carregarLista();
        } else {
          exibirToast(res.erro, 'erro');
        }
      },
    });
  };

  const formatarValor = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',');

  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={st.mainScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={st.secaoTitulo}>
            {editandoId ? '✏️ Editar Produto' : '➕ Novo Produto'}
          </Text>
          <View style={st.formCard}>
            <Campo
              label="Nome do produto *"
              valor={form.nome}
              aoMudar={(v) => atualizarCampo('nome', v)}
              placeholder="ex: Etiqueta BOPP Brilho"
            />
            <Campo
              label="Descrição"
              valor={form.descricao}
              aoMudar={(v) => atualizarCampo('descricao', v)}
              placeholder="ex: Etiqueta para uso externo"
            />
            <Campo
              label="Material"
              valor={form.material}
              aoMudar={(v) => atualizarCampo('material', v)}
              placeholder="ex: BOPP"
            />
            <View style={st.linha2}>
              <View style={{ flex: 1 }}>
                <Campo label="Largura" valor={form.largura} aoMudar={(v) => atualizarCampo('largura', v)} placeholder="ex: 10cm" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Campo label="Comprimento" valor={form.comprimento} aoMudar={(v) => atualizarCampo('comprimento', v)} placeholder="ex: 5cm" />
              </View>
            </View>
            <Campo
              label="Preço Unitário (R$) *"
              valor={form.precoUnit}
              aoMudar={(v) => atualizarCampo('precoUnit', v)}
              placeholder="ex: 0.25"
              teclado="numeric"
            />

            <TouchableOpacity
              style={[st.btnSalvar, carregando && st.btnDesabilitado]}
              onPress={salvar}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando
                ? <ActivityIndicator color="#fff" />
                : <Text style={st.btnSalvarTexto}>
                    {editandoId ? '💾 SALVAR ALTERAÇÕES' : '📦 CADASTRAR PRODUTO'}
                  </Text>
              }
            </TouchableOpacity>

            {!!editandoId && (
              <TouchableOpacity style={[st.btnCancelar, { marginTop: 10 }]} onPress={cancelarEdicao}>
                <Text style={st.btnCancelarTexto}>Cancelar edição</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={st.listaHeader}>
            <Text style={st.secaoTitulo}>Produtos Cadastrados</Text>
            <View style={st.contadorBadge}>
              <Text style={st.contadorTexto}>{lista.length}</Text>
            </View>
          </View>

          {lista.length === 0 ? (
            <View style={st.estadoVazio}>
              <Text style={st.estadoVazioIcone}>📦</Text>
              <Text style={st.estadoVazioTexto}>Nenhum produto cadastrado ainda</Text>
            </View>
          ) : (
            lista.map((item) => (
              <View key={item.id} style={st.itemCard}>
                <View style={st.itemInfo}>
                  <Text style={st.itemTotal}>{item.nome}</Text>
                  <Text style={st.itemLinha}>{formatarValor(item.precoUnit)} / unidade</Text>
                  {!!item.material    && <Text style={st.itemLinha}>🧾 {item.material}</Text>}
                  {!!item.largura     && <Text style={st.itemLinha}>↔️ {item.largura}</Text>}
                  {!!item.comprimento && <Text style={st.itemLinha}>↕️ {item.comprimento}</Text>}
                  {!!item.descricao   && <Text style={st.itemLinha}>📝 {item.descricao}</Text>}
                </View>
                <View style={st.itemAcoes}>
                  <TouchableOpacity
                    style={[st.btnEnviarCard, { backgroundColor: COR.azulClr, borderColor: COR.azulBorda }]}
                    onPress={() => editar(item)}
                    activeOpacity={0.75}>
                    <Text style={[st.btnEnviarCardIcone, { color: COR.azul }]}>✏️</Text>
                    <Text style={[st.btnEnviarCardTexto, { color: COR.azul }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.btnDeletar} onPress={() => pedirDelecao(item.id)} activeOpacity={0.7}>
                    <Text style={st.btnDeletarTexto}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {!!toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} aoEsconder={() => setToast(null)} />}
      <ModalConfirmar
        visivel={!!confirmar}
        mensagem={confirmar ? confirmar.mensagem : ''}
        aoConfirmar={confirmar ? confirmar.aoConfirmar : () => {}}
        aoCancelar={() => setConfirmar(null)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// TELA AUTENTICADA (wrapper com topbar + navbar)
// ─────────────────────────────────────────────
function TelaAutenticada({ user, aoSair }) {
  const [telaAtiva, setTelaAtiva] = useState('orcamentos');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COR.fundo }}>
      <StatusBar barStyle="light-content" backgroundColor={COR.laranjaEsc} />

      {/* Barra de topo */}
      <View style={st.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={st.topTitulo}>
            {telaAtiva === 'orcamentos' ? '🏷️ Orçamentos' : '📦 Produtos'}
          </Text>
          <Text style={st.topEmail} numberOfLines={1}>{user.email}</Text>
        </View>
        <TouchableOpacity style={st.btnSair} onPress={aoSair} activeOpacity={0.8}>
          <Text style={st.btnSairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo */}
      <View style={{ flex: 1 }}>
        {telaAtiva === 'orcamentos'
          ? <TelaOrcamentos user={user} />
          : <TelaProdutos   user={user} />
        }
      </View>

      {/* Navbar inferior */}
      <NavBar telaAtiva={telaAtiva} aoMudarTela={setTelaAtiva} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// APP PRINCIPAL
// ─────────────────────────────────────────────
export default function App() {
  const [tela, setTela] = useState('login');
  const [user, setUser] = useState(null);

  if (tela === 'login') {
    return (
      <TelaLogin
        aoLogar={(u) => {
          setUser(u);
          setTela('home');
        }}
      />
    );
  }

  return (
    <TelaAutenticada
      user={user}
      aoSair={() => {
        AuthService.logout();
        setUser(null);
        setTela('login');
      }}
    />
  );
}

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
const st = StyleSheet.create({
  // ── LOGIN ──────────────────────────────────
  loginSafe:   { flex: 1, backgroundColor: COR.laranjaEsc },
  loginScroll: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingBottom: 40 },

  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 84, height: 84, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoEmoji: { fontSize: 38 },
  appTitulo: { fontSize: 26, fontWeight: '700', color: '#fff' },
  appSub:    { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  loginCard: {
    backgroundColor: COR.card, borderRadius: 22, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },

  tabs:             { flexDirection: 'row', backgroundColor: '#f5ede3', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn:           { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabBtnAtivo:      { backgroundColor: '#fff', shadowColor: COR.laranja, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  tabBtnTexto:      { fontSize: 14, fontWeight: '600', color: '#8a6a4a' },
  tabBtnTextoAtivo: { color: COR.laranja },

  erroBox:   { backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fecaca', borderRadius: 9, padding: 10, marginBottom: 14 },
  erroTexto: { color: '#b91c1c', fontSize: 13 },
  okBox:     { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 9, padding: 10, marginBottom: 14 },
  okTexto:   { color: '#15803d', fontSize: 13 },

  // ── REQUISITOS ─────────────────────────────
  requisitoBox:         { backgroundColor: '#fdf8f3', borderWidth: 1, borderColor: '#e8d5be', borderRadius: 10, padding: 12, marginBottom: 14 },
  requisitoLinha:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  requisitoTexto:       { fontSize: 12, fontWeight: '500' },
  requisitoAtendido:    { color: '#16a34a' },
  requisitoNaoAtendido: { color: '#9a7560' },

  // ── INPUTS ─────────────────────────────────
  campoWrap:    { marginBottom: 14 },
  campoLabel:   { fontSize: 11, fontWeight: '700', color: '#8a6a4a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  campoLinha:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf8f3', borderWidth: 1.5, borderColor: '#e8d5be', borderRadius: 10 },
  input:        { flex: 1, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 15, color: COR.marrom },
  campoDirWrap: { paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },

  btnPrimario:      { backgroundColor: COR.laranja, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnDesabilitado:  { opacity: 0.5 },
  btnPrimarioTexto: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },

  // ── TOPO ───────────────────────────────────
  topBar:      { backgroundColor: COR.laranjaEsc, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  topTitulo:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  topEmail:    { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  btnSair:     { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  btnSairTexto:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── NAVBAR ─────────────────────────────────
  navBar:        { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8d5be' },
  navItem:       { flex: 1, alignItems: 'center', paddingVertical: 10 },
  navItemAtivo:  { borderTopWidth: 2, borderTopColor: COR.laranja },
  navIcone:      { fontSize: 22 },
  navLabel:      { fontSize: 11, color: '#b08060', marginTop: 2, fontWeight: '500' },
  navLabelAtivo: { color: COR.laranja, fontWeight: '700' },

  // ── TELA PRINCIPAL ─────────────────────────
  mainScroll: { padding: 16 },

  secaoTitulo:   { fontSize: 17, fontWeight: '700', color: COR.marrom, marginBottom: 12, marginTop: 8 },
  listaHeader:   { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  contadorBadge: { backgroundColor: '#f5ede3', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  contadorTexto: { color: COR.laranja, fontSize: 12, fontWeight: '700' },

  formCard: {
    backgroundColor: COR.card, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  linha2: { flexDirection: 'row' },

  totalBox:   { backgroundColor: COR.laranja, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  totalValor: { color: '#fff', fontSize: 22, fontWeight: '700' },

  btnSalvar:      { backgroundColor: COR.marrom, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSalvarTexto: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.4 },

  estadoVazio:      { alignItems: 'center', paddingVertical: 50 },
  estadoVazioIcone: { fontSize: 42, marginBottom: 10 },
  estadoVazioTexto: { color: '#b08060', fontSize: 14 },

  // ── CARD DE ITEM ───────────────────────────
  itemCard: {
    backgroundColor: COR.card, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  itemInfo:   { flex: 1 },
  itemTotal:  { fontSize: 19, fontWeight: '700', color: COR.laranja, marginBottom: 4 },
  itemLinha:  { fontSize: 13, color: '#7a5a3a', marginTop: 2 },
  itemData:   { fontSize: 11, color: '#bba080', marginTop: 8, fontStyle: 'italic' },
  itemAcoes:  { alignItems: 'center', marginLeft: 10 },

  btnEnviarCard:      { backgroundColor: COR.verdeClr, borderWidth: 1, borderColor: COR.verdeBorda, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', marginBottom: 8, minWidth: 62 },
  btnEnviarCardIcone: { fontSize: 16, color: COR.verde },
  btnEnviarCardTexto: { fontSize: 10, fontWeight: '700', color: COR.verde, marginTop: 2 },

  btnDeletar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center' },
  btnDeletarTexto: { color: '#ef4444', fontSize: 15, fontWeight: '700' },

  // ── TOAST ──────────────────────────────────
  toast: {
    position: 'absolute', bottom: 28, left: 20, right: 20,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
  },
  toastTexto: { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center' },

  // ── MODAIS ─────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },

  confirmBox:       { backgroundColor: COR.card, borderRadius: 18, padding: 24, width: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  confirmTitulo:    { fontSize: 17, fontWeight: '700', color: COR.marrom, textAlign: 'center', marginBottom: 8 },
  confirmMsg:       { fontSize: 14, color: '#7a5a3a', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  confirmBtns:      { flexDirection: 'row' },
  btnCancelar:      { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e8d5be', alignItems: 'center', marginRight: 8 },
  btnCancelarTexto: { fontSize: 14, fontWeight: '600', color: '#7a5a3a' },
  btnExcluir:       { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center' },
  btnExcluirTexto:  { fontSize: 14, fontWeight: '600', color: '#fff' },

  enviarBox:    { backgroundColor: COR.card, borderRadius: 20, padding: 22, width: '100%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 },
  enviarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  enviarTitulo: { fontSize: 17, fontWeight: '700', color: COR.marrom },
  enviarFechar: { fontSize: 18, color: '#aaa', fontWeight: '700' },

  abas:             { flexDirection: 'row', backgroundColor: '#f5ede3', borderRadius: 10, padding: 4, marginBottom: 16 },
  abaBtn:           { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  abaBtnAtiva:      { backgroundColor: '#fff', shadowColor: COR.laranja, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  abaBtnTexto:      { fontSize: 13, fontWeight: '600', color: '#8a6a4a' },
  abaBtnTextoAtiva: { color: COR.laranja },

  enviarResumo:        { backgroundColor: '#fdf8f3', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#e8d5be' },
  enviarResumoLinha:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  enviarResumoLabel:   { fontSize: 12, color: '#8a6a4a', fontWeight: '600' },
  enviarResumoTotal:   { fontSize: 20, fontWeight: '700', color: COR.laranja },
  enviarResumoDetalhe: { fontSize: 12, color: '#8a6a4a', lineHeight: 18 },

  enviarCampoLabel: { fontSize: 11, fontWeight: '700', color: '#8a6a4a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  enviarDica:       { fontSize: 12, color: '#aaa', marginTop: 8, marginBottom: 20, lineHeight: 17 },

  btnEnviar:      { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: COR.verde, alignItems: 'center' },
  btnEnviarTexto: { fontSize: 14, fontWeight: '700', color: '#fff' },

  telPrefixo: { paddingHorizontal: 12, fontSize: 14, fontWeight: '600', color: COR.marrom },
});