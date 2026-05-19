import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Linking,
} from 'react-native';

import * as SQLite from 'expo-sqlite';
import Hashes from 'jshashes';


// ================= HASH =================

const SHA256 = new Hashes.SHA256();

const SECRET_KEY = '@MinhaChave123';

const hash = text =>
  SHA256.hex(text + SECRET_KEY);


// ================= SQLITE =================

const db = SQLite.openDatabaseSync('app.db');


// ================= INIT DATABASE =================

function initDB() {
  try {

    db.execSync(`

      CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
      );

      CREATE TABLE IF NOT EXISTS orcamentos(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quantidade TEXT,
        precoUnitario TEXT,
        total TEXT
      );

    `);

    console.log("Banco iniciado");

  } catch(error) {

    console.log(
      "Erro DB:",
      error
    );

  }
}


// ================= AUTH =================

const Auth = {

register(email,password){

try{

db.runSync(

`INSERT INTO users
(email,password)

VALUES (?,?)`,

[
email,
hash(password)
]

);

return true;

}
catch{

throw new Error();

}

},


login(email,password){

const result=

db.getAllSync(

`SELECT * FROM users
WHERE email=?
AND password=?`,

[
email,
hash(password)
]

);

return result.length>0;

}

};


// ================= ORÇAMENTOS =================

const Orcamento={

save(item){

db.runSync(

`
INSERT INTO orcamentos(
quantidade,
precoUnitario,
total
)

VALUES(?,?,?)
`,

[
item.quantidade,
item.precoUnitario,
item.total
]

);

},


list(){

return db.getAllSync(

`
SELECT *
FROM orcamentos
ORDER BY id DESC
`

);

}

};


// ================= LOGIN SCREEN =================

function LoginScreen({onLogin}){

const[email,setEmail]=
useState("");

const[pass,setPass]=
useState("");

const[confirm,setConfirm]=
useState("");

const[loading,setLoading]=
useState(false);

const[isLogin,setIsLogin]=
useState(true);


async function handle(){

if(
!email ||
!pass
){

Alert.alert(
"Erro",
"Preencha todos os campos"
);

return;

}


setLoading(true);


if(!isLogin){

if(pass!==confirm){

Alert.alert(
"Erro",
"Senhas diferentes"
);

setLoading(false);

return;

}

try{

Auth.register(
email,
pass
);

Alert.alert(
"Sucesso",
"Conta criada"
);

setIsLogin(true);

}
catch{

Alert.alert(
"Erro",
"Usuário já existe"
);

}

setLoading(false);

return;

}


const ok=
Auth.login(
email,
pass
);

setLoading(false);


if(ok){

onLogin();

}else{

Alert.alert(
"Erro",
"Login inválido"
);

}

}


return(

<View style={styles.container}>


<Text style={styles.title}>
Etiquetas
</Text>


<TextInput
style={styles.input}
placeholder="Email"
keyboardType="email-address"
autoCapitalize="none"
value={email}
onChangeText={setEmail}
/>


<TextInput
style={styles.input}
placeholder="Senha"
secureTextEntry
value={pass}
onChangeText={setPass}
/>


{
!isLogin && (

<TextInput
style={styles.input}
placeholder="Confirmar senha"
secureTextEntry
value={confirm}
onChangeText={setConfirm}
/>

)
}


<TouchableOpacity
style={styles.button}
onPress={handle}
>

{loading?

<ActivityIndicator color="#fff"/>

:

<Text style={styles.btnText}>

{isLogin
?
"ENTRAR"
:
"CADASTRAR"}

</Text>

}

</TouchableOpacity>


<TouchableOpacity
onPress={()=>
setIsLogin(
!isLogin
)
}
>

<Text style={styles.link}>

{
isLogin
?
"Criar conta"
:
"Já tenho conta"
}

</Text>

</TouchableOpacity>


</View>

)

}


// ================= HOME =================

function Home({onLogout}){

const[qtd,setQtd]=
useState("");

const[preco,setPreco]=
useState("");

const[list,setList]=
useState([]);


useEffect(()=>{

load();

},[]);


function load(){

const dados=
Orcamento.list();

setList(dados);

}


const total=(

(
(+qtd||0)
*
(+preco||0)
)

.toFixed(2)

);


function salvar(){

if(
!qtd ||
!preco
){

Alert.alert(
"Atenção",
"Preencha os campos"
);

return;

}


Orcamento.save({

quantidade:qtd,
precoUnitario:preco,
total

});


setQtd("");

setPreco("");

load();

}


function whatsapp(item){

const msg=

`Orçamento

Quantidade:
${item.quantidade}

Total:
R$ ${item.total}`;

const url=

`https://wa.me/?text=${
encodeURIComponent(msg)
}`;

Linking.openURL(
url
);

}


function email(item){

const msg=

`Orçamento

Quantidade:
${item.quantidade}

Total:
R$ ${item.total}`;


const url=

`mailto:
?subject=Orçamento
&body=${
encodeURIComponent(msg)
}`;


Linking.openURL(
url
);

}


return(

<View style={styles.container}>


<TouchableOpacity
style={styles.logout}
onPress={onLogout}
>

<Text style={styles.btnText}>
SAIR
</Text>

</TouchableOpacity>


<TextInput
style={styles.input}
placeholder="Quantidade"
keyboardType="numeric"
value={qtd}
onChangeText={setQtd}
/>


<TextInput
style={styles.input}
placeholder="Preço"
keyboardType="numeric"
value={preco}
onChangeText={setPreco}
/>


<Text style={styles.total}>

Total:
R$ {total}

</Text>


<TouchableOpacity
style={styles.button}
onPress={salvar}
>

<Text style={styles.btnText}>
SALVAR
</Text>

</TouchableOpacity>


<FlatList
data={list}
keyExtractor={(item)=>
item.id.toString()
}

renderItem={({item})=>(

<View style={styles.card}>


<Text>
Qtd:
{item.quantidade}
</Text>


<Text>
Preço:
R$ {item.precoUnitario}
</Text>


<Text>
Total:
R$ {item.total}
</Text>


<TouchableOpacity
style={styles.wpp}
onPress={()=>
whatsapp(item)
}
>

<Text style={styles.btnText}>
WhatsApp
</Text>

</TouchableOpacity>


<TouchableOpacity
style={styles.mail}
onPress={()=>
email(item)
}
>

<Text style={styles.btnText}>
Email
</Text>

</TouchableOpacity>


</View>

)}
/>

</View>

)

}


// ================= APP =================

export default function App(){

const[screen,setScreen]=
useState("login");


useEffect(()=>{

initDB();

},[]);


return(

<SafeAreaView
style={{flex:1}}
>

{

screen==="login"

?

<LoginScreen
onLogin={()=>
setScreen("home")
}
/>

:

<Home
onLogout={()=>
setScreen("login")
}
/>

}

</SafeAreaView>

)

}


// ================= STYLE =================

const styles=StyleSheet.create({

container:{
flex:1,
padding:20,
backgroundColor:"#C97B2A"
},

title:{
fontSize:30,
fontWeight:"bold",
color:"#fff",
textAlign:"center",
marginBottom:30
},

input:{
backgroundColor:"#fff",
padding:14,
borderRadius:8,
marginBottom:12
},

button:{
backgroundColor:"#007AFF",
padding:14,
borderRadius:8,
alignItems:"center"
},

btnText:{
color:"#fff",
fontWeight:"bold"
},

link:{
marginTop:20,
textAlign:"center"
},

logout:{
backgroundColor:"red",
padding:10,
borderRadius:8,
marginBottom:20
},

total:{
fontSize:22,
fontWeight:"bold",
color:"#fff",
textAlign:"center",
marginVertical:15
},

card:{
backgroundColor:"#fff",
padding:12,
borderRadius:8,
marginTop:10
},

wpp:{
backgroundColor:"#25D366",
padding:8,
marginTop:10,
borderRadius:6,
alignItems:"center"
},

mail:{
backgroundColor:"#007AFF",
padding:8,
marginTop:5,
borderRadius:6,
alignItems:"center"
}

});
