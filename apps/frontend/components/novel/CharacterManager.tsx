'use client';

import { useState } from 'react';
import { Users, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { novelsAPI } from '@/lib/api';
import { toast } from 'sonner';

interface Character {
  id: string;
  name: string;
  role: string;
  personality: string[];
  abilities: { name: string; level: number }[];
  currentState?: string;
}

interface CharacterManagerProps {
  novelId: string;
  characters: Character[];
  onUpdate: () => void;
}

export default function CharacterManager({ novelId, characters, onUpdate }: CharacterManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    personality: '',
    abilities: '',
    currentState: '',
  });

  const handleOpenModal = (character?: Character) => {
    if (character) {
      setEditingCharacter(character);
      setFormData({
        name: character.name,
        role: character.role,
        personality: character.personality.join('、'),
        abilities: character.abilities.map(a => `${a.name}:${a.level}`).join('、'),
        currentState: character.currentState || '',
      });
    } else {
      setEditingCharacter(null);
      setFormData({
        name: '',
        role: '',
        personality: '',
        abilities: '',
        currentState: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('请输入姓名');
      return;
    }
    const data = {
      name: formData.name,
      role: formData.role,
      personality: formData.personality.split(/[,，、]/).filter(Boolean),
      abilities: formData.abilities.split(/[,，、]/).filter(Boolean).map(a => {
        const [name, level] = a.split(/[:：]/);
        return { name, level: parseInt(level) || 1 };
      }),
      currentState: formData.currentState,
    };

    try {
      if (editingCharacter) {
        await novelsAPI.updateCharacter(novelId, editingCharacter.id, data);
        toast.success('人物资料已更新');
      } else {
        await novelsAPI.createCharacter(novelId, data);
        toast.success('人物添加成功');
      }
      setIsModalOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to save character:', error);
      toast.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个人物吗？')) {
      try {
        await novelsAPI.deleteCharacter(novelId, id);
        toast.success('人物已删除');
        onUpdate();
      } catch (error) {
        console.error('Failed to delete character:', error);
        toast.error('删除失败');
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">人物卡</h2>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-2" />
          添加人物
        </Button>
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>暂无人物卡</p>
          <p className="text-sm mt-2">点击上方按钮添加人物</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {characters.map((character) => (
            <div key={character.id} className="glass p-6 rounded-xl hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {character.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{character.role}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal(character)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(character.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    性格特征
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {character.personality.map((trait, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    能力
                  </p>
                  <div className="space-y-1">
                    {character.abilities.map((ability, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{ability.name}</span>
                        <span className="text-primary-500 font-semibold">Lv.{ability.level}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {character.currentState && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      当前状态
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {character.currentState}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Character Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCharacter ? '编辑人物' : '添加人物'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">姓名</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：林凡"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">角色定位</label>
            <Input
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="例如：主角、配角、反派"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">性格特征（用 、 分隔）</label>
            <Input
              value={formData.personality}
              onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
              placeholder="例如：坚韧、聪慧、重情义"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">能力（格式：能力名:等级，用 、 分隔）</label>
            <Input
              value={formData.abilities}
              onChange={(e) => setFormData({ ...formData, abilities: e.target.value })}
              placeholder="例如：剑术:5、炼丹:3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">当前状态</label>
            <Textarea
              value={formData.currentState}
              onChange={(e) => setFormData({ ...formData, currentState: e.target.value })}
              placeholder="描述人物当前的状态、处境等"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingCharacter ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
