import React from "react";
import { ActivityIndicator, ActivityIndicatorProps } from "react-native";
import Colors from "@/constants/colors";

export function Spinner(props: ActivityIndicatorProps) {
  return <ActivityIndicator color={Colors.gold} {...props} />;
}

export default Spinner;
