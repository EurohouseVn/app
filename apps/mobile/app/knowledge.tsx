import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { colors } from '@eurohouse/ui';
import { api } from '../src/lib/api';

const categories = [
  { id: 'ALL', name: 'Tất cả' },
  { id: 'CUTTING_GUIDE', name: 'Cắt nhôm' },
  { id: 'CONSTRUCTION_GUIDE', name: 'Thi công' },
  { id: 'PRODUCT_INFO', name: 'Sản phẩm' },
  { id: 'CREATIVE_GUIDE', name: 'Mẹo hay' },
];

const defaultGuides = [
  {
    id: 'g-1',
    title: 'Quy trình sản xuất & cắt cửa sổ lùa 2 cánh hệ 55 chuẩn EUROHOUSE',
    category: 'Cắt nhôm',
    system: 'Hệ 55',
    readTime: '5 phút đọc',
    description: 'Hướng dẫn chi tiết từ khâu đo đạc, trừ độ hở khung bao, cắt ke vuông góc 45 độ và ép góc ke ma thuật chống sệ cánh.',
    icon: 'video'
  },
  {
    id: 'g-2',
    title: 'Kỹ thuật lắp đặt & căn chỉnh Cửa sổ Ecento 70 & Ecento Plus',
    category: 'Thi công',
    system: 'Ecento 70',
    readTime: '7 phút đọc',
    description: 'Phương pháp rà phẳng tường, bơm keo xốp silicone bám dính chắc chắn và chỉnh bản lề 3D nhịp nhàng không bị xệ.',
    icon: 'tool'
  },
  {
    id: 'g-3',
    title: 'So sánh thông số kỹ thuật Nhôm Euroqueen và Ecento Plus',
    category: 'Sản phẩm',
    system: 'Euroqueen / Ecento',
    readTime: '4 phút đọc',
    description: 'Bảng tổng hợp độ dày 1.0mm - 2.0mm, hợp kim nhôm 6063-T5 và quy trình sơn tĩnh điện chống ăn mòn dải bờ biển.',
    icon: 'book-open'
  }
];

export default function KnowledgeScreen() {
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/content/knowledge');
      setArticles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const displayList = articles.length > 0 ? articles : defaultGuides;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AppHeader title="Học viện & Kỹ thuật" subtitle="Cẩm nang & Video thi công Eurohouse" />

      {/* Category Tabs */}
      <View style={{ backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {categories.map((cat) => {
            const active = selectedCat === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCat(cat.id)}
                style={{
                  backgroundColor: active ? colors.brandOrange : '#f1f5f9',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: active ? '#fff' : '#475569', fontWeight: '800', fontSize: 13 }}>{cat.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Học viện Eurohouse */}
        <View style={styles.academyBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>EUROHOUSE ACADEMY</Text>
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>Chứng nhận Thợ Pro</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 2 }}>Nâng Cao Tay Nghề & Kỹ Thuật Thi Công</Text>
          <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>Học tập chuẩn hóa quy trình sản xuất nhôm cửa công nghệ mới.</Text>
        </View>

        <Text style={{ fontSize: 16, fontWeight: '900', color: colors.brandBlack.main, marginTop: 4 }}>Bài viết & Cẩm nang mới nhất</Text>

        {displayList.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ backgroundColor: colors.orangeSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: colors.brandOrangeText, fontWeight: '800', fontSize: 11 }}>{item.category || item.system || 'Kỹ thuật'}</Text>
              </View>
              {item.readTime ? <Text style={{ color: '#94a3b8', fontSize: 11 }}>{item.readTime}</Text> : null}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.description || item.content || 'Không có mô tả'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12 }}>
              <Text style={{ color: colors.brandOrange, fontWeight: '800', fontSize: 13 }}>Xem chi tiết</Text>
              <Icon name="chevron-right" size={16} color={colors.brandOrange} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 110 },
  academyBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brandBlack.main,
    lineHeight: 22,
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
  },
});
