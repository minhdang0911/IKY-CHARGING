import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import icBack from '../../assets/img/ic_back.png'; // đổi path đúng thư mục mày nha

export default function SimpleHeader({ title, onBack, rightSlot, color = '#1e88e5' }) {
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: color }]}>
      <StatusBar translucent={false} backgroundColor={color} barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: color }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Image source={icBack} style={{ width: 22, height: 22, tintColor: '#fff' }} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>

        <View style={{ width: 32, alignItems: 'flex-end' }}>{rightSlot}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#1e88e5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
});
