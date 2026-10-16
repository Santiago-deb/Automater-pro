Tipo: Maquina de Turing
Estados: 2
Transiciones: 5
Tamaño alfabeto: 1
Cantidad de Cintas: 3
Descripción de estados:
e0
e1
Cintas: 
X
Y
X+Y
Descripción de Transiciones:
Nº	Estado	X	Y	X+Y	Nº	Estado	Simb.	Mov.	Simb.	Mov.	Simb.	Mov.	Nº	Nvo.Estado	Comentario
0	e0	1			1	N		N		N	@Copiar(e1,e1,(X,X+Y))	copia de X-->X+Y, si falla termina igual					
1	e0		1			N	1	N		N	@Copiar(e1,e1,(Y,X+Y))	copia de Y-->X+Y					
2	e0	1	1		1	N		N		N	@Copiar(e0,e1,(X,X+Y))	copia de X-->X+Y					
3	e0					N		N		N	e1						
4	e1																
Alfabeto reconocido: 
1
Estado Final: 	e1
Estado Inicial: 	e0
Modulos: 1
Copiar	CopiarC1EnC2.MT
