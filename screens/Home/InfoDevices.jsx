// screens/Home/ComingSoon.jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PRIMARY = '#1e88e5';

const ComingSoon = ({navigateToScreen,screenData}) => {


 

    const handleNotificationPress = () => {
    navigateToScreen('Device');
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="construction" size={80} color={PRIMARY} />
      </View>
      <Text style={styles.title}>Coming Soon</Text>
      <Text style={styles.subTitle}>
        Tính năng này đang được phát triển. Vui lòng quay lại sau.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleNotificationPress}>
        <Text style={styles.buttonText}>Quay lại</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ComingSoon;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconWrap: {
    backgroundColor: '#e3f2fd',
    borderRadius: 100,
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: PRIMARY,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 25,
  },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
