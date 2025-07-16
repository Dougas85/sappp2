from flask import Flask, render_template, jsonify, request, redirect, session, url_for
import csv
import datetime
import random
import os
import psycopg2
from dotenv import load_dotenv
from zoneinfo import ZoneInfo
import chardet

# Carrega variáveis de ambiente
load_dotenv(dotenv_path=".env.local")
DATABASE_URL = os.getenv("DATABASE_URL")

app = Flask(__name__)
app.secret_key = 'chave-super-secreta'

MATRICULAS_AUTORIZADAS = {
    '81111045', '81143494', '88942872', '89090489', '89114051', '86518496',
    '89166078', '81129726', '81120575', '81126077', '81134290', '89126661',
    '81134533', '81151888'
}

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def get_valid_csv_data(lista='SAPPP'):
    if lista.upper() == 'CHECKLIST':
        path = 'data/CHECKLIST.csv'
        encoding = 'utf-8'
        delimiter = ','
    else:
        path = 'data/SAPPP_office.csv'
        encoding = 'windows-1252'
        delimiter = ';'

    if not os.path.exists(path):
        print(f"[ERRO] Arquivo {path} não encontrado.")
        return []

    with open(path, newline='', encoding=encoding) as csvfile:
        reader = csv.reader(csvfile, delimiter=delimiter)
        rows = list(reader)

    valid_rows = []
    for i, row in enumerate(rows):
        if row and row[0].strip().isdigit():
            valid_rows.append([row[0].strip()] + row[1:])
    return valid_rows

def get_items_for_today(lista='SAPPP', rows=None):
    today = datetime.datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    if today.weekday() >= 5:
        return []

    if rows is None:
        rows = get_valid_csv_data(lista)

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT item_1, item_2, item_3 FROM daily_items WHERE date = %s;", (today,))
        row = cur.fetchone()

        if row:
            selected_ids = [str(i) for i in row if i]
            cur.close()
            conn.close()
            return [item for item in rows if str(item[0]) in selected_ids]

        all_ids = [str(row[0]) for row in rows]

        cur.execute("SELECT item_id FROM used_items;")
        used_ids = {str(r[0]) for r in cur.fetchall()}

        available_ids = [i for i in all_ids if i not in used_ids]

        if not available_ids:
            cur.execute("DELETE FROM used_items;")
            conn.commit()
            available_ids = all_ids.copy()

        random.shuffle(available_ids)
        selected_ids = available_ids[:3]

        item_1, item_2, item_3 = (selected_ids + [None] * 3)[:3]

        cur.execute(
            "INSERT INTO daily_items (date, item_1, item_2, item_3) VALUES (%s, %s, %s, %s);",
            (today, item_1, item_2, item_3)
        )

        for item_id in selected_ids:
            cur.execute("INSERT INTO used_items (item_id, used_on) VALUES (%s, %s);", (item_id, today))

        conn.commit()
        cur.close()
        conn.close()
        return [item for item in rows if str(item[0]) in selected_ids]

    except Exception as e:
        print(f"[ERRO] {e}")
        import traceback
        traceback.print_exc()
        return []

@app.route('/')
def index():
    if 'matricula' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', acesso_completo=session.get('acesso_completo', False))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        matricula = request.form.get('matricula')
        session['matricula'] = matricula
        session['acesso_completo'] = matricula in MATRICULAS_AUTORIZADAS
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/get_lines')
def get_lines():
    lista = request.args.get('lista', 'SAPPP')
    rows = get_valid_csv_data(lista)
    items = get_items_for_today(lista, rows)

    # Se for CHECKLIST, remove itens acima de 60
    if lista.upper() == 'CHECKLIST':
        items = [item for item in items if int(item[0]) <= 60]

    return jsonify([
        {
            "descricao": item[1],
            "numero": item[0],
            "peso": item[2],
            "orientacao": item[5] if len(item) > 5 else "Sem orientação",
            "referencia": item[6] if len(item) > 6 else "Sem referência"
        }
        for item in items
    ])

@app.route('/get_item_details/<int:item_num>')
def get_item_details(item_num):
    lista = request.args.get('lista', 'SAPPP')
    rows = get_valid_csv_data(lista)
    item = next((row for row in rows if str(row[0]) == str(item_num)), None)
    if item:
        return jsonify({
            "descricao": item[1],
            "numero": item[0],
            "peso": item[2],
            "orientacao": item[5] if len(item) > 5 else "Sem orientação",
            "referencia": item[6] if len(item) > 6 else "Sem referência"
        })
    return jsonify({"error": "Item não encontrado"}), 404

@app.route('/search_items/<string:query>')
def search_items(query):
    lista = request.args.get('lista', 'SAPPP')
    rows = get_valid_csv_data(lista)
    query = query.lower()
    return jsonify([
        {
            "descricao": item[1],
            "numero": item[0],
            "peso": item[2],
            "orientacao": item[5] if len(item) > 5 else "Sem orientação",
            "referencia": item[6] if len(item) > 6 else "Sem referência"
        }
        for item in rows if query in item[1].lower()
    ])

@app.route('/get_all_items')
def get_all_items():
    lista = request.args.get('lista', 'SAPPP')
    rows = get_valid_csv_data(lista)
    return jsonify([
        {
            "descricao": item[1],
            "numero": item[0],
            "peso": int(item[2]) if item[2].isdigit() else 0,
            "na": item[4]
        }
        for item in rows
    ])

@app.route('/simulador')
def simulador():
    return render_template("simulador.html")

@app.route('/test_csv')
def test_csv():
    lista = request.args.get('lista', 'SAPPP')
    rows = get_valid_csv_data(lista)
    return f"Total de linhas válidas: {len(rows)}"

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
