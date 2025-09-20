import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

const LoadingOverlay = ({ visible }) => {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <ActivityIndicator size="large" color="#00BFFF" />
            </View>
        </Modal>
    );
};

export default LoadingOverlay;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
