import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ visible, title, message, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onCancel} activeOpacity={0.85}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirm, destructive && styles.destructive]} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,.42)',alignItems:'center',justifyContent:'center',padding:22},
  card:{width:'100%',maxWidth:440,backgroundColor:'#fff',borderRadius:24,padding:22,shadowColor:'#000',shadowOpacity:.16,shadowRadius:22,elevation:8},
  title:{fontSize:21,fontWeight:'900',color:'#20312A'},
  message:{fontSize:14,lineHeight:21,color:'#667870',marginTop:8},
  actions:{flexDirection:'row',gap:10,marginTop:20},
  cancel:{flex:1,height:50,borderRadius:15,backgroundColor:'#F1F5F2',alignItems:'center',justifyContent:'center'},
  cancelText:{fontSize:14,fontWeight:'800',color:'#61726A'},
  confirm:{flex:1,height:50,borderRadius:15,backgroundColor:'#2DBE60',alignItems:'center',justifyContent:'center'},
  destructive:{backgroundColor:'#D94A56'},
  confirmText:{fontSize:14,fontWeight:'900',color:'#fff'},
});
