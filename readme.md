### Documentação de Integração: Login do Google com React Native e Expo

Este documento registra o passo a passo técnico realizado para configurar e homologar com sucesso a autenticação nativa do Google em um projeto construído com **Expo (SDK 51+)**, utilizando a biblioteca oficial @react-native-google-signin/google-signin e contornando restrições de rede corporativa (Proxy/Certificados). 

### 🛠️ 1. Configuração do Ambiente do Projeto

### Instalação da Dependência Nativa

Como a biblioteca interage diretamente com as APIs do Google Play Services no Android, realizamos a instalação gerenciada pelo Expo CLI: 

```bash

# Comando executado ignorando restrições de SSL da rede corporativa
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npx expo install @react-native-google-signin/google-signin
```

### Configuração do Arquivo app.json

Ajustamos o manifesto do Expo para declarar a identidade única do aplicativo no ecossistema Android e injetar as propriedades nativas de compilação: 

```json
{
  "expo": {
    "name": "Teste-login-do-google",
    "slug": "Teste-login-do-google",
    "version": "1.0.0",
    "android": {
      "package": "com.mazzor.testelogingoogle",
      "edgeToEdgeEnabled": true
    },
    "plugins": [
      ["@react-native-google-signin/google-signin"]
    ],
    "extra": {
      "eas": {
        "projectId": "1090720b-b983-4f28-bb3a-082660cbae3f"
      }
    }
  }
}
```


### 🔑 2. Geração das Credenciais e Chaves de Criptografia (SHA-1)

O Google exige que a chave digital de assinatura do aplicativo (Keystore) esteja perfeitamente vinculada ao identificador do pacote. 

### Criação do Perfil de Chaves via EAS CLI

Para criar o ambiente de chaves criptográficas sem depender das restrições de rede do local, configuramos o perfil eas.json na raiz e executamos o gerenciador do Expo: 

```bash

npx eas credentials
```

* **Plataforma Selecionada:** Android
* **Perfil:** development
* **Ação:** Criar uma nova Keystore controlada pelo Expo.

O comando gerou com sucesso as assinaturas digitais do projeto no servidor. Coletamos a seguinte impressão digital única: 

* **SHA1 Fingerprint:** 04:54:3C:5C:75:C8:1B:0D:7A:D3:D5:2E:20:4D:72:D3:D7:08:A3:2E

### 🌐 3. Homologação no Google Cloud Console

Com os dados de identificação gerados, acessamos o painel de APIs do Google Cloud para criar os pontos de acesso (OAuth 2.0). 

### Passo A: Cadastro do Cliente Nativo (Android)

1. Criamos uma credencial do tipo **ID do cliente OAuth** -> **Android**.
2. Vinculamos o nome do pacote exato: com.mazzor.testelogingoogle.
3. Injetamos o código **SHA-1 Fingerprint** extraído no terminal do Expo.

### Passo B: Cadastro do Cliente Web (Ponte de Autenticação)

Mesmo sendo uma aplicação nativa para celular, a biblioteca exige uma credencial do tipo Web para atuar como servidor de troca de tokens. 

1. Criamos um segundo ID do cliente OAuth -> **Aplicativo da Web**.
2. Nomeamos como Web Credencial Expo e mantivemos as URLs de redirecionamento vazias.
3. O Google nos retornou o ID definitivo:
837413223985-fm017c8bj84nu9rfe72sjd77v1icdf96.apps.googleusercontent.com

### 📦 Funcionamento e Arquitetura do @react-native-google-signin/google-signin

A biblioteca @react-native-google-signin/google-signin foi adotada como a camada de abstração nativa (ponte) responsável por conectar o código JavaScript/TypeScript do React Native com os serviços de identidade do sistema operacional Android (**Google Play Services**). 

A implementação foi dividida em quatro etapas fundamentais dentro do ciclo de vida do aplicativo: 

### A. Inicialização e Acoplamento (GoogleSignin.configure)

A biblioteca necessita de instruções prévias para saber qual projeto dentro do ecossistema do Google Cloud Console está gerenciando as permissões de acesso. Essa parametrização ocorre de forma assíncrona na inicialização do app: 

* **webClientId**: Injeção do token gerado na credencial do tipo "Aplicativo da Web". O ecossistema do ecossistema Google exige este identificador específico para realizar a troca segura de pacotes e a assinatura dos tokens OAuth entre o dispositivo móvel e a nuvem.
* **offlineAccess: true**: Habilita o aplicativo a receber códigos de autorização do servidor (Server Auth Codes), permitindo futuras validações de identidade em background de forma segura.

### B. Validação Física de Dependências (hasPlayServices)

Antes de acionar a interface visual de autenticação, o método await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }) realiza uma checagem em nível de hardware: 

* O código verifica se os serviços nativos do Google Play estão ativos no aparelho celular.
* Caso os serviços estejam ausentes ou desatualizados, a biblioteca intercepta o fluxo lançando uma exceção amigável (PLAY_SERVICES_NOT_AVAILABLE), mitigando que o aplicativo quebre ou trave subitamente na mão do usuário.

### C. Disparo do Fluxo de Autenticação Nativa (signIn)

O método await GoogleSignin.signIn() é o gatilho principal da operação: 

1. O interpretador JavaScript do React Native suspende temporariamente o fluxo do app e transfere o controle para a thread nativa do Android.
2. O sistema operacional exibe uma folha de estilo de diálogo nativa (Bottom Sheet) listando as contas Google autenticadas no dispositivo.
3. O usuário seleciona a conta desejada através de autenticação biométrica ou senha configurada no próprio aparelho.
4. Os servidores de segurança do Google cruzam a assinatura digital (**SHA-1 Fingerprint**) do APK de desenvolvimento instalado no celular com a chave cadastrada no console. Se os registros coincidirem, a transação é autorizada.

### D. Captura do Payload e Tratamento de Exceções

Após a validação do Google, a biblioteca devolve o fluxo de dados para a aplicação. O utilitário isSuccessResponse(response) assegura a integridade do objeto recebido antes de salvar os dados no estado do React (setUserInfo): 

* **Payload Extraído com Sucesso**: userInfo.user.name (Nome de registro), userInfo.user.email (Endereço de e-mail) e userInfo.user.photo (URI da imagem de avatar hospedada no Google).
* **Tratamento de Erros por Constantes (statusCodes)**: O ecossistema intercepta dinamicamente interrupções do usuário através do bloco catch. Se o usuário apenas fechar o modal arrastando para baixo, o erro é catalogado como statusCodes.SIGN_IN_CANCELLED e tratado no console sem expor alertas críticos ou travar a experiência do usuário.

### 💻 4. Implementação do Código Fonte (App.tsx)

O fluxo visual foi desenhado para se adaptar dinamicamente ao estado da sessão. O código final integrado ficou da seguinte forma: 

```typescript

import React, { useEffect, useState, ReactElement } from 'react';
import { StyleSheet, Text, View, Button, Image, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  SignInSuccessResponse,
  NativeModuleError
} from '@react-native-google-signin/google-signin';

export default function App(): ReactElement {
  const [userInfo, setUserInfo] = useState<SignInSuccessResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '837413223985-fm017c8bj84nu9rfe72sjd77v1icdf96.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const signIn = async (): Promise<void> => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        setUserInfo(response.data);
      }
    } catch (error) {
      const nativeError: NativeModuleError = error as NativeModuleError;

      if (nativeError.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Usuário cancelou o login');
      } else if (nativeError.code === statusCodes.IN_PROGRESS) {
        console.log('Login já está em progresso');
      } else if (nativeError.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('Play Services não disponível ou desatualizado');
      } else {
        console.log('Erro desconhecido:', nativeError.message || nativeError);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await GoogleSignin.signOut();
      setUserInfo(null);
    } catch (error) {
      console.error('Erro ao deslogar:', error);
    }
  };

  return (
    <View style={styles.container}>
      {userInfo ? (
        <View style={styles.profileContainer}>
          {userInfo.user.photo ? (
            <Image source={{ uri: userInfo.user.photo }} style={styles.avatar} />
          ) : null}
          <Text style={styles.text}>{userInfo.user.name}</Text>
          <Text>{userInfo.user.email}</Text>
          <Button title="Sair" onPress={signOut} disabled={loading} />
        </View>
      ) : (
        <Button
          title={loading ? 'Carregando...' : 'Entrar com Google'}
          onPress={signIn}
          disabled={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```
Use o código com cuidado.

### 📱 5. Processo de Build e Homologação Física

A integração de login nativo **não funciona dentro do ambiente Expo Go**, exigindo a geração de um executável real local para testes (Development Build). 

Compilamos as modificações diretamente no celular via cabo utilizando comandos offline para evitar bloqueios de certificados de proxy: 

```powershell

# 1. Limpeza de chaves locais antigas e geração da estrutura nativa do Android
npx expo prebuild --clean --offline

# 2. Compilação do código Java/Kotlin e injeção do APK direto no dispositivo móvel
npx expo run:android --offline

```

Use o código com cuidado.

### Resultado Obtido

O aplicativo compilou com êxito pelo motor do Gradle, abriu a janela suspensa do sistema operacional para seleção de contas de e-mail ativas do celular, coletou com precisão o token de autenticação e imprimiu na interface o nome e a foto do usuário de testes.