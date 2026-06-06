import { Check, FileText, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { Script, useScripts } from '@/hooks/use-scripts';

const theme = Colors.dark;

export default function ScriptsScreen() {
  const {
    scripts,
    activeScriptId,
    loading,
    addScript,
    updateScript,
    deleteScript,
    setActiveScriptId,
  } = useScripts();

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleOpenNew = () => {
    setEditingScript(null);
    setTitle('');
    setContent('');
    setEditorVisible(true);
  };

  const handleOpenEdit = (script: Script) => {
    setEditingScript(script);
    setTitle(script.title);
    setContent(script.content);
    setEditorVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;

    if (editingScript) {
      await updateScript(editingScript.id, title, content);
    } else {
      await addScript(title, content);
    }
    setEditorVisible(false);
  };

  const handleDelete = async (id: string) => {
    await deleteScript(id);
  };

  const renderScriptItem = ({ item }: { item: Script }) => {
    const isActive = item.id === activeScriptId;

    return (
      <Pressable
        style={[styles.scriptCard, isActive && styles.scriptCardActive]}
        onPress={() => setActiveScriptId(item.id)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardSelectArea}>
            {/* Radio button */}
            <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
              {isActive && <View style={styles.radioInner} />}
            </View>
            <Text style={[styles.scriptTitle, isActive && styles.scriptTitleActive]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </View>

        <Text style={styles.scriptPreview} numberOfLines={3}>
          {item.content || '(No text content)'}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.scriptDate}>
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>

          <View style={styles.cardActions}>
            <Pressable
              style={styles.actionButtonEdit}
              onPress={(e) => { e.stopPropagation(); handleOpenEdit(item); }}>
              <Pencil size={14} color={theme.primary} />
              <Text style={styles.actionTextEdit}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.actionButtonDelete}
              onPress={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
              <Trash2 size={14} color="#ff453a" />
              <Text style={styles.actionTextDelete}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scripts</Text>
          <Text style={styles.headerSubtitle}>Choose a script to run on the camera</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.infoText}>Loading scripts...</Text>
        </View>
      ) : scripts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FileText size={64} color={theme.backgroundSelected} />
          <Text style={styles.emptyTitle}>No Scripts Yet</Text>
          <Text style={styles.emptySubtitle}>
            Create your first script to start prompting while you record.
          </Text>
          <Pressable style={styles.emptyButton} onPress={handleOpenNew}>
            <Plus size={18} color="#fff" />
            <Text style={styles.emptyButtonText}>Create Script</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={scripts}
          keyExtractor={(item) => item.id}
          renderItem={renderScriptItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating Action Button — always visible */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleOpenNew}>
        <Plus size={28} color="#fff" />
      </Pressable>

      {/* Editor Modal */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditorVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalHeaderBtn} onPress={() => setEditorVisible(false)}>
              <X size={20} color={theme.textSecondary} />
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {editingScript ? 'Edit Script' : 'New Script'}
            </Text>
            <Pressable style={styles.modalHeaderBtn} onPress={handleSave}>
              <Check size={20} color={theme.primary} />
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>

          <View style={styles.modalForm}>
            <TextInput
              style={styles.titleInput}
              placeholder="Script Title"
              placeholderTextColor={theme.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.contentInput}
              placeholder="Start writing your script here..."
              placeholderTextColor={theme.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </View>
        </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    paddingHorizontal: 20,
    paddingBottom: 110, // Extra space so FAB doesn't cover last item
    gap: 16,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  scriptCard: {
    backgroundColor: theme.backgroundElement,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  scriptCardActive: {
    borderColor: theme.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSelectArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  scriptTitle: {
    color: theme.textSecondary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  scriptTitleActive: {
    color: theme.text,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionTextEdit: {
    color: theme.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  actionButtonDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: 'rgba(255,68,58,0.12)',
  },
  actionTextDelete: {
    color: '#ff453a',
    fontWeight: '700',
    fontSize: 13,
  },
  // Radio button
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: theme.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: theme.primary,
  },
  scriptPreview: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  scriptDate: {
    color: theme.textSecondary,
    fontSize: 12,
    opacity: 0.7,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    color: theme.textSecondary,
  },
  emptyContainer: {
    flex: 1,
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
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // Modal editor styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#151618',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalCancelText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  modalHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSaveText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  titleInput: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 10,
  },
  contentInput: {
    color: theme.text,
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
    paddingVertical: 10,
  },
});
