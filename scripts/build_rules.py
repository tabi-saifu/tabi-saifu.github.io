"""database.rules.json を作る。明細の検査を3か所で同じにするため、手書きせずここから生成する。

使い方: python3 scripts/build_rules.py
"""
import json
from pathlib import Path

V = "auth != null && auth.token.email_verified === true"
DATE = "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"
CODE = "/^[A-Z0-9]{6}$/"


def trip_fields(extra=None):
    fields = {
        "name": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 60"},
        "country_code": {".validate": "newData.isString() && newData.val().matches(/^[A-Z]{2}$/)"},
        "currency": {".validate": "newData.isString() && newData.val().matches(/^[A-Z]{3}$/)"},
        "start_date": {".validate": DATE},
        "end_date": {".validate": DATE},
        "card_fee_pct": {".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 20"},
        "created_at": {".validate": "newData.isNumber()"},
        "$other": {".validate": False},
    }
    fields.update(extra or {})
    return fields


def expense_fields(shared):
    required = ["spent_on", "title", "category", "payment", "amount_local", "currency", "rate_to_jpy", "amount_jpy", "created_at"]
    if shared:
        required.append("shared")
    fields = {
        ".validate": "newData.hasChildren([%s])" % ", ".join("'%s'" % r for r in required),
        "spent_on": {".validate": DATE},
        "title": {".validate": "newData.isString() && newData.val().length <= 80"},
        "category": {".validate": "newData.isString() && newData.val().matches(/^(food|shopping|transport|hotel|sightseeing|other)$/)"},
        "payment": {".validate": "newData.isString() && newData.val().matches(/^(card|cash)$/)"},
        "amount_local": {".validate": "newData.isNumber() && newData.val() > 0 && newData.val() < 1000000000000"},
        "currency": {".validate": "newData.isString() && newData.val().matches(/^[A-Z]{3}$/)"},
        "rate_to_jpy": {".validate": "newData.isNumber() && newData.val() > 0"},
        "rate_date": {".validate": DATE},
        "amount_jpy": {".validate": "newData.isNumber() && newData.val() >= 0"},
        "created_at": {".validate": "newData.isNumber()"},
        "$other": {".validate": False},
    }
    if shared:
        # 立て替えた人も、割る人も、その旅行の参加者でなければならない
        # paid_by → shared → $eid → expenses → $gid
        fields["shared"] = {
            ".validate": "newData.hasChildren(['paid_by', 'split'])",
            "paid_by": {".validate": "newData.isString() && newData.parent().parent().parent().parent().child('members').child(newData.val()).exists()"},
            "split": {
                ".validate": "newData.hasChildren()",
                "$m": {".validate": "newData.val() === true && newData.parent().parent().parent().parent().parent().child('members').child($m).exists()"},
            },
            "$other": {".validate": False},
        }
    return fields


OWNER = V + " && auth.uid === $uid"
rules = {
    "rules": {
        "tabi_saifu": {
            "users": {
                "$uid": {
                    ".read": OWNER,
                    ".write": OWNER,
                    "trips": {"$tripId": dict(trip_fields(), **{
                        ".validate": "newData.hasChildren(['name', 'country_code', 'currency', 'card_fee_pct', 'created_at'])",
                    })},
                    "expenses": {"$tripId": {
                        ".validate": "newData.parent().parent().child('trips').child($tripId).exists()",
                        "$expenseId": expense_fields(False),
                    }},
                    "groups": {"$gid": {".validate": "newData.val() === true"}},
                    "gexpenses": {"$gid": {
                        # 自分だけの出費は、参加している旅行にしか付けられない
                        ".validate": "root.child('tabi_saifu/groups').child($gid).child('members').child($uid).exists()",
                        "$expenseId": expense_fields(False),
                    }},
                    "$other": {".validate": False},
                }
            },
            "groups": {
                "$gid": {
                    # 参加者だけが読める
                    ".read": V + " && data.child('members').child(auth.uid).exists()",
                    "meta": dict(trip_fields({
                        "owner": {".validate": "newData.isString()"},
                    }), **{
                        ".write": V + " && (data.parent().child('members').child(auth.uid).exists() || (!data.exists() && newData.child('owner').val() === auth.uid))",
                        ".validate": "newData.hasChildren(['name', 'country_code', 'currency', 'card_fee_pct', 'created_at', 'owner']) && (!data.exists() || newData.child('owner').val() === data.child('owner').val())",
                    }),
                    "code": {
                        # 作った人が最初に1回だけ決める
                        ".write": V + " && !data.exists() && newData.parent().child('meta').child('owner').val() === auth.uid",
                        ".validate": "newData.isString() && newData.val().matches(%s)" % CODE,
                    },
                    "members": {
                        "$m": {
                            # 自分自身だけを、正しい招待コードを示したときに加えられる。抜けるのは自由
                            ".write": V + " && auth.uid === $m && (!newData.exists() || newData.child('code').val() === newData.parent().parent().child('code').val())",
                            ".validate": "newData.hasChildren(['name', 'code', 'joined_at'])",
                            "name": {".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 20"},
                            "code": {".validate": "newData.isString()"},
                            "joined_at": {".validate": "newData.isNumber()"},
                            "$other": {".validate": False},
                        }
                    },
                    "expenses": {
                        "$eid": dict(expense_fields(True), **{
                            ".write": V + " && data.parent().parent().child('members').child(auth.uid).exists()",
                        })
                    },
                    "$other": {".validate": False},
                }
            },
            "invites": {
                "$code": {
                    # コードを知っている人だけが引ける。一覧はできない
                    ".read": V,
                    ".write": V + " && !data.exists() && newData.parent().parent().child('groups').child(newData.child('gid').val()).child('meta').child('owner').val() === auth.uid",
                    ".validate": "newData.hasChildren(['gid']) && $code.matches(%s)" % CODE,
                    "gid": {".validate": "newData.isString()"},
                    "$other": {".validate": False},
                }
            },
        }
    }
}

Path(__file__).resolve().parent.parent.joinpath("database.rules.json").write_text(json.dumps(rules, ensure_ascii=False, indent=2) + "\n")
print("database.rules.json written")
