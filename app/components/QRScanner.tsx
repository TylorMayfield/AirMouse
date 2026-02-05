import { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import { Button } from 'react-native-paper';

const { width } = Dimensions.get('window');

type CameraViewProps = {
  onScan: (url: string) => void;
  onClose: () => void;
};

export function CameraView({ onScan, onClose }: CameraViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Button onPress={requestPermission}>Request camera permission</Button>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Button onPress={requestPermission}>Grant camera access</Button>
        <Button onPress={onClose} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ExpoCameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned
            ? undefined
            : (e) => {
                const data = e.data;
                if (data && (data.startsWith('airmouse://') || data.startsWith('http'))) {
                  setScanned(true);
                  onScan(data);
                }
              }
        }
      />
      <Button onPress={onClose} style={styles.closeBtn}>
        Cancel
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 320,
    marginBottom: 16,
  },
  camera: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  closeBtn: {
    marginTop: 8,
  },
  centered: {
    padding: 24,
  },
});
