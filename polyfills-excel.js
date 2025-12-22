import 'react-native-get-random-values';
import { decode as atob, encode as btoa } from 'base-64';
import { Buffer } from 'buffer';

if (!global.atob) global.atob = atob;
if (!global.btoa) global.btoa = btoa;
if (!global.Buffer) global.Buffer = Buffer;
