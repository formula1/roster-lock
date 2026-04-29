// LinkedList Node
class ListNode<T> {
  constructor(
    public value: T,
    public next: ListNode<T> | null = null,
    public prev: ListNode<T> | null = null
  ){}
}

export class LinkedList<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private _length = 0;

  push(value: T){
    const node = new ListNode(value);
    if(!this.tail) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }
    this._length++;
  }

  pop(): T | undefined{
    if(!this.tail) return undefined;
    const value = this.tail.value;
    this._length--;
    if(!this.tail.prev){
      this.head = null;
      this.tail = null;
    } else {
      this.tail = this.tail.prev;
      this.tail.next = null;
    }
    return value;
  }

  shift(): T | undefined{
    if(!this.head) return undefined;
    const value = this.head.value;
    this._length--;
    if(!this.head.next){
      this.head = null;
      this.tail = null;
    } else {
      this.head = this.head.next;
      this.head.prev = null;
    }
    return value;
  }

  unshift(value: T){
    const node = new ListNode(value);
    if(!this.head) {
      this.head = this.tail = node;
    } else {
      this.head.prev = node;
      node.next = this.head;
      this.head = node;
    }
    this._length++;
  }

  peekStart(): T | undefined{
    return this.head?.value;
  }

  peekEnd(): T | undefined{
    return this.tail?.value;
  }

  isEmpty(): boolean{
    return this._length === 0;
  }

  get length(): number{
    return this._length;
  }

  [Symbol.iterator](): Iterator<T>{
    let current = this.head;
    return {
      next: ()=>{
        if(!current) return { done: true, value: undefined };
        const value = current.value;
        current = current.next;
        return { done: false, value };
      },
    };
  }

  clear(){
    this.head = this.tail = null;
    this._length = 0;
  }
}
