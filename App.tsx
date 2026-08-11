import React, { useEffect, useState, ReactElement } from 'react';
import { StyleSheet, Text, View, Button, Image, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  SignInSuccessResponse,
  NativeModuleError
} from '@react-native-google-signin/google-signin';

interface Styles {
  container: ViewStyle;
  profileContainer: ViewStyle;
  avatar: ImageStyle;
  text: TextStyle;
}

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