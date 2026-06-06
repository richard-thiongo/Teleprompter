import { CameraMode, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Camera, FileText, ImageIcon, Minus, Pause, Play, Plus, RefreshCw, SlidersHorizontal, SwitchCamera, Video, XCircle, Zap, ZapOff } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useScripts } from '@/hooks/use-scripts';

const theme = Colors.dark;

export default function CameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const { activeScript, settings, updateSettings } = useScripts();

  const [facing, setFacing] = useState<'front' | 'back'>('front'); // Default to front for vlogging/teleprompting
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<CameraMode>('video'); // Default to video for teleprompter apps
  
  // Teleprompter state
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [lastAssetUri, setLastAssetUri] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const allGranted = cameraPermission?.granted && micPermission?.granted;

  const loading = !cameraPermission || !micPermission;

  // Load last asset thumbnail on mount
  useEffect(() => {
    loadLastAsset();
  }, []);

  // Teleprompter auto-scroll animation loop
  useEffect(() => {
    let animationId: number;

    const scroll = () => {
      if (isPlaying && scrollViewRef.current) {
        // Scroll step based on speed settings
        const step = settings.speed * 0.15;
        const nextY = scrollY.current + step;

        const maxScroll = contentHeight - containerHeight;
        if (maxScroll > 0 && nextY >= maxScroll + 40) {
          setIsPlaying(false);
          return;
        }

        scrollY.current = nextY;
        scrollViewRef.current.scrollTo({ y: scrollY.current, animated: false });
        animationId = requestAnimationFrame(scroll);
      }
    };

    if (isPlaying && activeScript) {
      animationId = requestAnimationFrame(scroll);
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, settings.speed, contentHeight, containerHeight, activeScript]);

  async function requestAll() {
    await requestCameraPermission();
    await requestMicPermission();
  }

  function toggleFacing() {
    setFacing(f => (f === 'back' ? 'front' : 'back'));
  }

  function cycleFlash() {
    setFlash(f => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'));
  }

  const loadLastAsset = async () => {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      const mediaFiles = files
        .filter(f => f.startsWith('teleprompt_'))
        .sort((a, b) => b.localeCompare(a)); // Sort descending to get latest first
      if (mediaFiles.length > 0) {
        setLastAssetUri(`${FileSystem.documentDirectory}${mediaFiles[0]}`);
      } else {
        setLastAssetUri(null);
      }
    } catch (e) {
      console.error('Failed to load last asset', e);
    }
  };

  async function handleCapture() {
    if (!cameraRef.current) return;

    if (mode === 'picture') {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
        if (photo?.uri) {
          const fileName = `teleprompt_${Date.now()}.jpg`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.moveAsync({
            from: photo.uri,
            to: fileUri,
          });
          loadLastAsset();
        }
      } catch (e) {
        console.error('Photo capture failed:', e);
      }
    } else {
      if (isRecording) {
        cameraRef.current.stopRecording();
        setIsRecording(false);
        setIsPlaying(false);
      } else {
        setIsRecording(true);
        // Reset scroll and start teleprompter play automatically after brief delay
        scrollY.current = 0;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
        }
        setTimeout(() => {
          setIsPlaying(true);
        }, 500);

        try {
          const video = await cameraRef.current.recordAsync();
          if (video?.uri) {
            const fileName = `teleprompt_${Date.now()}.mp4`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.moveAsync({
              from: video.uri,
              to: fileUri,
            });
            loadLastAsset();
          }
        } catch (e: any) {
          const message = e?.message ?? '';
          if (message.includes('Unknown error') || message.includes('Video recording failed')) {
            Alert.alert(
              'Video Recording Not Supported',
              'Video recording requires a development build. Expo Go on Android does not support video recording.\n\nPhoto mode still works!',
              [{ text: 'OK' }]
            );
          } else {
            console.error('Recording failed:', e);
          }
        } finally {
          setIsRecording(false);
          setIsPlaying(false);
        }
      }
    }
  }

  function handleResetScroll() {
    scrollY.current = 0;
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
    setIsPlaying(false);
  }

  // Removed flashSymbol mapping since we use explicit Lucide icons

  // --- Loading ---
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // --- Permission Denied ---
  if (!allGranted) {
    return (
      <View style={styles.centered}>
        <View style={styles.permissionCard}>
          <Camera
            size={56}
            color={theme.primary}
          />
          <Text style={styles.permissionTitle}>Permissions Required</Text>
          <Text style={styles.permissionSubtitle}>
            We need camera and microphone access to record videos.
          </Text>
          {(!cameraPermission?.canAskAgain || !micPermission?.canAskAgain) ? (
            <Pressable
              style={styles.permissionButton}
              onPress={() => Linking.openSettings()}>
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.permissionButton} onPress={requestAll}>
              <Text style={styles.permissionButtonText}>Grant Permissions</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode={mode}
      />

      {/* Prompter Overlay */}
      {mode === 'video' && (
        <View style={styles.prompterWrapper}>
          {activeScript ? (
            <View style={styles.prompterBox}>
              {/* Focus guide overlay */}
              {showGuide && <View style={styles.focusGuide} />}
              
              <ScrollView
                ref={scrollViewRef}
                style={styles.prompterScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                onScroll={(e) => {
                  scrollY.current = e.nativeEvent.contentOffset.y;
                }}
                onContentSizeChange={(_, h) => setContentHeight(h)}
                onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}>
                <View
                  style={[
                    styles.prompterTextContainer,
                    { transform: [{ scaleX: settings.isMirrored ? -1 : 1 }] },
                  ]}>
                  {/* Padding to allow text to start in the center of the guide */}
                  <View style={{ height: containerHeight / 2 - 20 }} />
                  <Text style={[styles.prompterText, { fontSize: settings.fontSize }]}>
                    {activeScript.content}
                  </Text>
                  {/* Padding to allow text to scroll fully past */}
                  <View style={{ height: containerHeight / 2 }} />
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={[styles.prompterBox, styles.prompterBoxEmpty]}>
              <Text style={styles.noScriptText}>No Active Script Selected</Text>
              <Pressable
                style={styles.selectScriptButton}
                onPress={() => router.push('/scripts')}>
                <FileText size={16} color="#fff" />
                <Text style={styles.selectScriptButtonText}>Go to Scripts</Text>
              </Pressable>
            </View>
          )}

          {/* Prompter Overlay Controls */}
          {activeScript && (
            <View style={styles.prompterControls}>
              <Pressable
                style={styles.prompterCtrlBtn}
                onPress={handleResetScroll}>
                <RefreshCw size={16} color="#fff" />
                <Text style={styles.prompterCtrlText}>Reset</Text>
              </Pressable>

              <Pressable
                style={[styles.prompterCtrlBtn, styles.prompterCtrlPlayBtn]}
                onPress={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
                <Text style={styles.prompterCtrlText}>
                  {isPlaying ? 'Pause' : 'Play'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.prompterCtrlBtn}
                onPress={() => setSettingsVisible(!settingsVisible)}>
                <SlidersHorizontal size={16} color="#fff" />
                <Text style={styles.prompterCtrlText}>Settings</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Top Controls */}
      <SafeAreaView style={styles.topBar}>
        {/* Flash */}
        <Pressable style={styles.iconButton} onPress={cycleFlash}>
          {flash === 'off' ? (
            <ZapOff size={22} color="#fff" />
          ) : (
            <Zap size={22} color="#fff" fill={flash === 'on' ? '#fff' : 'none'} />
          )}
          <Text style={styles.iconLabel}>
            {flash.charAt(0).toUpperCase() + flash.slice(1)}
          </Text>
        </Pressable>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, mode === 'picture' && styles.modeButtonActive]}
            onPress={() => { setMode('picture'); setIsRecording(false); setIsPlaying(false); }}>
            <Camera
              size={14}
              color={mode === 'picture' ? '#fff' : 'rgba(255,255,255,0.6)'}
            />
            <Text style={[styles.modeText, mode === 'picture' && styles.modeTextActive]}>
              Photo
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'video' && styles.modeButtonActive]}
            onPress={() => { setMode('video'); }}>
            <Video
              size={14}
              color={mode === 'video' ? '#fff' : 'rgba(255,255,255,0.6)'}
            />
            <Text style={[styles.modeText, mode === 'video' && styles.modeTextActive]}>
              Video
            </Text>
          </Pressable>
        </View>

        {/* Flip */}
        <Pressable style={styles.iconButton} onPress={toggleFacing}>
          <SwitchCamera
            size={22}
            color="#fff"
          />
          <Text style={styles.iconLabel}>Flip</Text>
        </Pressable>
      </SafeAreaView>

      {/* Settings Overlay Panel */}
      {settingsVisible && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Prompter Settings</Text>
            <Pressable style={styles.settingsCloseBtn} onPress={() => setSettingsVisible(false)}>
              <XCircle size={20} color={theme.textSecondary} />
              <Text style={styles.settingsCloseText}>Close</Text>
            </Pressable>
          </View>

          {/* Scroll Speed Adjust */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Scroll Speed</Text>
            <View style={styles.settingControlGroup}>
              <Pressable
                style={[styles.adjustBtn, settings.speed <= 1 && styles.adjustBtnDisabled]}
                disabled={settings.speed <= 1}
                onPress={() => updateSettings({ speed: Math.max(1, settings.speed - 1) })}>
                <Minus size={16} color="#fff" />
              </Pressable>
              <Text style={styles.settingValue}>{settings.speed}x</Text>
              <Pressable
                style={[styles.adjustBtn, settings.speed >= 10 && styles.adjustBtnDisabled]}
                disabled={settings.speed >= 10}
                onPress={() => updateSettings({ speed: Math.min(10, settings.speed + 1) })}>
                <Plus size={16} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Font Size Adjust */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Font Size</Text>
            <View style={styles.settingControlGroup}>
              <Pressable
                style={[styles.adjustBtn, settings.fontSize <= 16 && styles.adjustBtnDisabled]}
                disabled={settings.fontSize <= 16}
                onPress={() => updateSettings({ fontSize: Math.max(16, settings.fontSize - 2) })}>
                <Minus size={16} color="#fff" />
              </Pressable>
              <Text style={styles.settingValue}>{settings.fontSize}pt</Text>
              <Pressable
                style={[styles.adjustBtn, settings.fontSize >= 40 && styles.adjustBtnDisabled]}
                disabled={settings.fontSize >= 40}
                onPress={() => updateSettings({ fontSize: Math.min(40, settings.fontSize + 2) })}>
                <Plus size={16} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Mirror Toggle */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Mirror Text (Rig)</Text>
            <Pressable
              style={[styles.toggleBtn, settings.isMirrored && styles.toggleBtnActive]}
              onPress={() => updateSettings({ isMirrored: !settings.isMirrored })}>
              <Text style={styles.toggleBtnText}>
                {settings.isMirrored ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>

          {/* Focus Guide Toggle */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Focus Zone Indicator</Text>
            <Pressable
              style={[styles.toggleBtn, showGuide && styles.toggleBtnActive]}
              onPress={() => setShowGuide(!showGuide)}>
              <Text style={styles.toggleBtnText}>
                {showGuide ? 'SHOW' : 'HIDE'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Bottom Shutter & Gallery Thumbnail */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <View style={styles.shutterRow}>
          {/* Gallery Thumbnail */}
          <Pressable style={styles.thumbnailContainer} onPress={() => router.push('/gallery')}>
            {lastAssetUri ? (
              <Image source={{ uri: lastAssetUri }} style={styles.thumbnailImage} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <ImageIcon size={20} color="rgba(255,255,255,0.4)" />
              </View>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.shutterButton,
              mode === 'video' && styles.shutterVideo,
              isRecording && styles.shutterRecording,
            ]}
            onPress={handleCapture}>
            {mode === 'video' && isRecording ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={[
                styles.shutterInner,
                mode === 'video' && styles.shutterInnerVideo,
              ]} />
            )}
          </Pressable>

          <View style={styles.sideSlot} />
        </View>

        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  camera: {
    flex: 1,
  },
  // Permission Card
  permissionCard: {
    backgroundColor: theme.backgroundElement,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 340,
    gap: 12,
  },
  permissionTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionSubtitle: {
    color: theme.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: theme.primary,
    borderRadius: 50,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iconButton: {
    alignItems: 'center',
    minWidth: 56,
    gap: 4,
  },
  iconLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    padding: 3,
    gap: 2,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    gap: 5,
  },
  modeButtonActive: {
    backgroundColor: theme.primary,
  },
  modeText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontSize: 13,
  },
  modeTextActive: {
    color: '#fff',
  },
  // Prompter Styles
  prompterWrapper: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
    gap: 12,
  },
  prompterBox: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  prompterBoxEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  focusGuide: {
    position: 'absolute',
    top: '50%',
    left: 8,
    right: 8,
    height: 40,
    marginTop: -20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
    pointerEvents: 'none',
  },
  prompterScroll: {
    flex: 1,
  },
  prompterTextContainer: {
    paddingHorizontal: 16,
  },
  prompterText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
  },
  noScriptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
  },
  selectScriptButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 50,
  },
  selectScriptButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  prompterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  prompterCtrlBtn: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  prompterCtrlText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  prompterCtrlPlayBtn: {
    paddingHorizontal: 16,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.primary,
    borderColor: 'transparent',
  },
  // Settings Panel
  settingsPanel: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 16,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 12,
  },
  settingsCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  settingsCloseText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  settingControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnDisabled: {
    opacity: 0.3,
  },
  settingValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    minWidth: 40,
    textAlign: 'center',
  },
  toggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleBtnActive: {
    backgroundColor: theme.primary,
  },
  toggleBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 10,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlot: {
    width: 48,
  },
  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterVideo: {
    borderColor: '#f44336',
  },
  shutterRecording: {
    borderColor: '#f44336',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  shutterInnerVideo: {
    backgroundColor: '#f44336',
  },
  stopIcon: {
    width: 26,
    height: 26,
    borderRadius: 5,
    backgroundColor: '#f44336',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f44336',
  },
  recordingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.5,
  },
});
