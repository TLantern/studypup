import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  OAuthProvider,
  PhoneAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  signInAnonymously,
  signInWithCredential,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { getFirebase } from '@/lib/firebase';

GoogleSignin.configure({
  iosClientId: '114632107142-skgnhps8drg13j4rqjag4ijhneg6o7pa.apps.googleusercontent.com',
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

let phoneConfirmation: ConfirmationResult | null = null;

export async function startPhoneSignIn(phoneE164: string) {
  const { auth } = getFirebase();
  phoneConfirmation = await signInWithPhoneNumber(auth, phoneE164, undefined as any);
  return phoneConfirmation;
}

export async function confirmPhoneOtp(code: string) {
  if (!phoneConfirmation) throw new Error('No OTP session. Please request a new code.');
  return await phoneConfirmation.confirm(code);
}

export async function signInBypass() {
  const { auth } = getFirebase();
  return await signInAnonymously(auth);
}

export async function signInWithApple() {
  const { auth } = getFirebase();
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple sign-in failed: missing identity token.');

  const provider = new OAuthProvider('apple.com');
  const providerCred = provider.credential({ idToken: credential.identityToken, rawNonce: nonce });
  const result = await signInWithCredential(auth, providerCred);

  // Apple only sends fullName on the very first sign-in — persist it immediately before it's gone
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fullName && !result.user.displayName) {
    const { updateProfile } = await import('firebase/auth');
    await updateProfile(result.user, { displayName: fullName });
  }

  return result;
}

export async function linkApple(user: User) {
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple sign-in failed: missing identity token.');
  const provider = new OAuthProvider('apple.com');
  const providerCred = provider.credential({ idToken: credential.identityToken, rawNonce: nonce });
  return await linkWithCredential(user, providerCred);
}

export async function signInWithGoogle() {
  const { auth } = getFirebase();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  await GoogleSignin.signIn();
  const { idToken } = await GoogleSignin.getTokens();
  if (!idToken) throw new Error('Google sign-in failed: missing id_token.');
  const cred = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, cred);
}

export { statusCodes as googleStatusCodes };

export async function linkGoogle(user: User) {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  await GoogleSignin.signIn();
  const { idToken } = await GoogleSignin.getTokens();
  if (!idToken) throw new Error('Google sign-in failed: missing id_token.');
  const cred = GoogleAuthProvider.credential(idToken);
  return await linkWithCredential(user, cred);
}

export async function sendMagicLink(email: string) {
  const { auth } = getFirebase();
  // The domain of `url` must be in Firebase Console → Authentication → Settings → Authorized domains.
  // If you see auth/unauthorized-continue-uri, add this URL's host (e.g. studypup-b3973.firebaseapp.com) there.
  const actionCodeSettings = {
    url: 'https://trynotario.firebaseapp.com',
    handleCodeInApp: true,
  };
  await (await import('firebase/auth')).sendSignInLinkToEmail(auth, email, actionCodeSettings as any);
}

export async function completeMagicLink(url: string, email: string) {
  const { auth } = getFirebase();
  const { isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth');
  if (!isSignInWithEmailLink(auth, url)) throw new Error('Invalid magic link.');
  return await signInWithEmailLink(auth, email, url);
}

export async function linkEmailWithLink(user: User, email: string, link: string) {
  const { EmailAuthProvider } = await import('firebase/auth');
  const cred = EmailAuthProvider.credentialWithLink(email, link);
  return await linkWithCredential(user, cred);
}

export async function sendReauthOtp(phoneNumber: string): Promise<string> {
  const { auth } = getFirebase();
  const provider = new PhoneAuthProvider(auth);
  return await provider.verifyPhoneNumber(phoneNumber, undefined as any);
}export async function reauthenticateWithOtp(user: User, verificationId: string, code: string): Promise<void> {
  const cred = PhoneAuthProvider.credential(verificationId, code);
  await reauthenticateWithCredential(user, cred);
}