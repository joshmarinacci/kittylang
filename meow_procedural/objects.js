"use strict";

class Atom {
    constructor(val) { this.val = val; }
    resolve(scope)   { return this; }
    jsEquals(jsval)  { return this.val == jsval; }
}
class MNumber extends Atom {}
class MBoolean extends Atom {}
class MString extends Atom {}

class BinaryOp {
    constructor(op, A, B) {
        this.op = op;
        this.A = A;
        this.B = B;
    }
    resolve(scope) {
        var a = this.A.resolve(scope).val;
        var b = this.B.resolve(scope).val;
        if(this.op == 'add') return new MNumber(a+b);
        if(this.op == 'mul') return new MNumber(a*b);
        if(this.op == 'lt')  return new MBoolean(a<b);
        if(this.op == 'gt')  return new MBoolean(a>b);
        if(this.op == 'lte') return new MBoolean(a<=b);
        if(this.op == 'gte') return new MBoolean(a>=b);
        if(this.op == 'eq')  return new MBoolean(a==b);
        if(this.op == 'neq') return new MBoolean(a!=b);
    }
}

class Block {
    constructor(block) {
        this.statements = block;
    }
    resolve(scope) {
        var vals = this.statements.map((expr) => expr.resolve(scope));
        //only return the last one
        return vals.pop();
    }
}

class IfCond {
    constructor(cond, thenBody, elseBody) {
        this.cond = cond;
        this.thenBody = thenBody;
        this.elseBody = elseBody;
    }
    resolve(scope) {
        var val = this.cond.resolve(scope);
        if (val.val == true) {
            return this.thenBody.resolve(scope);
        }
        if(this.elseBody) return this.elseBody.resolve(scope);
        return new MBoolean(false);
    }
}


class Scope {
    constructor(parent) {
        this.storage = {};
        this.parent = parent?parent:null;
    }
    makeSubScope() {   return new Scope(this)  }
    hasSymbol(name) {  return this.getSymbol(name) != null }
    setSymbol(name, obj) {  this.storage[name] = obj; return this.storage[name] }
    getSymbol(name) {
        if(this.storage[name]) return this.storage[name];
        if(this.parent) return this.parent.getSymbol(name);
        return null;
    }
}


class MSymbol {
    constructor(name) {
        this.name = name;
    }
    resolve(scope) {
        return scope.getSymbol(this.name);
    }
}



class Assignment {
    constructor(val, sym) {
        this.symbol = sym;
        this.val = val;
    }
    resolve(scope) {
        return scope.setSymbol(this.symbol.name, this.val.resolve(scope));
    }
}

class FunctionCall {
    constructor(fun, args) {
        this.fun = fun;
        this.args = args;
    }
    resolve(scope) {
        //lookup the real function from the symbol
        if(!scope.hasSymbol(this.fun.name)) throw new Error("cannot resolve symbol " + this.fun.name);
        var fun = scope.getSymbol(this.fun.name);
        //resolve the args
        var args = this.args.map((arg) => arg.resolve(scope));
        //execute the function
        return fun.apply(null,args);
    }
}


class FunctionDef {
    constructor(sym, params, body) {
        this.sym = sym;
        this.params = params;
        this.body = body;
    }
    resolve(scope) {
        //create a global function for this body
        var body = this.body;
        var params = this.params;
        return scope.setSymbol(this.sym.name,function() {
            var args = arguments;
            var scope2 = scope.makeSubScope();
            params.forEach((param,i) => scope2.setSymbol(param.name,args[i]));
            return body.resolve(scope2);
        });
    }
}

module.exports = {
    MNumber: MNumber,
    MBoolean: MBoolean,
    MString: MString,
    BinaryOp: BinaryOp,
    MSymbol: MSymbol,
    Scope: Scope,
    Block: Block,
    IfCond: IfCond,
    Assignment: Assignment,
    FunctionCall: FunctionCall,
    FunctionDef: FunctionDef
};