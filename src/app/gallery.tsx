import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { ChevronLeft, Download, ImageIcon, Trash2, Video } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const theme = Colors.dark;

interface LocalAsset {
  id: string;
  uri: string;
  mediaType: 'photo' | 'video';
  creationTime: number;
}

function VideoPlayerComponent({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      style={styles.fullScreenVideo}
      player={player}
      nativeControls
      contentFit="contain"
    />
  );
}

export default function GalleryScreen() {
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<LocalAsset | null>(null);

  const { width } = useWindowDimensions();
  const columnWidth = width / 3;

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      const mediaFiles = files
        .filter(f => f.startsWith('teleprompt_'))
        .sort((a, b) => b.localeCompare(a)) // Latest first
        .map(name => {
          const isVideo = name.endsWith('.mp4') || name.endsWith('.mov');
          const timestampStr = name.replace('teleprompt_', '').split('.')[0];
          const timestamp = parseInt(timestampStr, 10) || Date.now();
          
          return {
            id: name,
            uri: `${FileSystem.documentDirectory}${name}`,
            mediaType: isVideo ? ('video' as const) : ('photo' as const),
            creationTime: timestamp,
          };
        });
      setAssets(mediaFiles);
    } catch (e) {
      console.error('Failed to fetch assets', e);
    } finally {
      setLoading(false);
    }
  };

  // Refetch assets whenever the gallery tab gains focus
  useFocusEffect(
    useCallback(() => {
      fetchAssets();
    }, [])
  );

  const handleDelete = async (asset: LocalAsset) => {
    try {
      await FileSystem.deleteAsync(asset.uri);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setSelectedAsset(null);
    } catch (e) {
      console.error('Failed to delete asset', e);
    }
  };

  const handleExport = async (asset: LocalAsset) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(asset.uri, {
          dialogTitle: 'Export Media',
        });
      } else {
        alert('Sharing is not available on this device');
      }
    } catch (e) {
      console.error('Failed to export asset', e);
      alert('Failed to export');
    }
  };

  const renderItem = ({ item }: { item: LocalAsset }) => {
    const isVideo = item.mediaType === 'video';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.gridItem,
          { width: columnWidth, height: columnWidth },
          pressed && styles.pressed,
        ]}
        onPress={() => setSelectedAsset(item)}>
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
        {isVideo && (
          <View style={styles.videoBadge}>
            <Video size={14} color="#fff" />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gallery</Text>
        <Text style={styles.headerSubtitle}>Browse your recorded teleprompter sessions</Text>
      </View>

      {loading && assets.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ImageIcon size={64} color={theme.backgroundSelected} />
          <Text style={styles.emptyTitle}>No Media Yet</Text>
          <Text style={styles.emptySubtitle}>
            Go record some videos or take photos in the Camera tab to see them here!
          </Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Full Screen Preview Modal */}
      <Modal
        visible={selectedAsset !== null}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setSelectedAsset(null)}>
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <SafeAreaView style={styles.modalHeader} edges={['top']}>
            <Pressable style={styles.headerBtn} onPress={() => setSelectedAsset(null)}>
              <ChevronLeft size={22} color="#fff" />
              <Text style={styles.headerBtnText}>Back</Text>
            </Pressable>

            <View style={styles.headerRightActions}>
              <Pressable
                style={styles.headerActionBtn}
                onPress={() => selectedAsset && handleExport(selectedAsset)}>
                <Download size={18} color={theme.primary} />
                <Text style={styles.actionTextExport}>Export</Text>
              </Pressable>

              <Pressable
                style={styles.headerActionBtn}
                onPress={() => selectedAsset && handleDelete(selectedAsset)}>
                <Trash2 size={18} color="#ff453a" />
                <Text style={styles.actionTextDelete}>Delete</Text>
              </Pressable>
            </View>
          </SafeAreaView>

          {/* Modal Body */}
          <View style={styles.previewContainer}>
            {selectedAsset && (
              selectedAsset.mediaType === 'video' ? (
                <VideoPlayerComponent uri={selectedAsset.uri} />
              ) : (
                <Image
                  source={{ uri: selectedAsset.uri }}
                  style={styles.fullScreenImage}
                  contentFit="contain"
                />
              )
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: theme.text,
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 24,
  },
  gridItem: {
    padding: 1,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pressed: {
    opacity: 0.8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  permissionButton: {
    backgroundColor: theme.primary,
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
  },
  // Full-screen Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionTextExport: {
    color: theme.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  actionTextDelete: {
    color: '#ff453a',
    fontWeight: '600',
    fontSize: 15,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
});
