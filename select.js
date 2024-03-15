import { LightningElement, api, track } from 'lwc';

function debounce(func, delay = 100) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}


const forOfAndIfMatch = (list = [], condition = () => true, ifMatchCallback = () => { }) => {
  for (const item of list) {
    if (condition(item)) {
      typeof ifMatchCallback === 'function' && ifMatchCallback(item)
      break;
    }
  }
}

export default class Select extends LightningElement {
  //是否允许查找
  @api showSearch
  //是否允许多选
  @api multiple
  //下拉选项列表
  @api options = []
  //过滤选项，参数一为 inputValue 参数二为options
  // @api filterOption = (inputVal, option) => option.label.includes(inputVal)
  @api filterOption = () => true //过滤选项，参数一为 inputValue 参数二为options

  //默认值，options 数据为空时会被忽略
  @api defaultValue = []
  // @api defaultValue = [] //默认值，options 数据为空时会被忽略

  //自定义输入时远程请求数据方法
  @api fetch
  // @api fetch = (newVal, startLoading, stopLoading) => {
  //   return new Promise(resolve => {
  //     startLoading()
  //     setTimeout(() => {
  //       stopLoading()
  //       resolve(getMockData(newVal))
  //     }, 2000)
  //   })
  // } //自定义输入时远程请求数据方法
  //防抖时间
  @api debounce = 300
  //占位符
  @api placeholder = 'Please input'
  //是否禁用
  @api disabled
  //位置
  @api placement = 'bottom'
  //💊显示我位置
  @api pillsPosition = 'inline'

  @api label = 'Label'
  //是否必填
  @api required
  //校验失败的错误信息
  @api errMessage = 'Please input!'


  //是否为加载中
  @track loading = false
  //文本框输入的值
  @track inputVal = ''
  //选中的值，单选为对象，多选为数组。Array when multiple is true，normal is an object
  @track selectedValue = null
  @track selectDropdownVisible = false
  @track optList = []
  //是否没有数据
  @track noData = false
  //错误信息用于显示
  @track errorMessage = ''
  @track isFocus = false
  //初始化标志位
  initialized = true
  //随机请求 Id
  randomRequestId = ''


  renderedCallback() {
    if (this.initialized) {
      this.setupDefaultValueAndOptList()
      this.setupEventListeners()

      this.initialized = false
    }
  }
  /**
   * 初始化默认值和下拉列表
   */
  setupDefaultValueAndOptList() {
    if (typeof this.defaultValue === 'string' || (Array.isArray(this.defaultValue) && this.defaultValue.length)) {
      // 有默认值
      const defaultIdArr = typeof this.defaultValue === 'string' ? this.defaultValue.split(',') : this.defaultValue
      if (!this.options.length) {
        // 有默认值但是没有传入下拉列表，默认使用 id 作为 label 和 value，等到有下拉列表数据了反向去更新。
        // selectedValue在 multiple 为 true 时为数组，在 multiple 为 false 的时候为对象
        this.selectedValue = this.multiple
          ? defaultIdArr.map(item => ({
            id: '' + item,
            label: '' + item,
            value: '' + item,
            selected: true
          }))
          : {
            id: '' + item,
            label: '' + item,
            value: '' + item,
            selected: true
          }
        if (!this.fetch || typeof this.fetch !== 'function') {
          this.noData = true
        }
      } else {
        this.optList = this.options.map(item => ({ ...item, selected: defaultIdArr.includes(item.id) }))
        const temp = this.optList.filter(item => defaultIdArr.includes(item.id))
        if (this.multiple) {
          this.selectedValue = temp
        } else {
          temp?.length > 0 && (this.selectedValue = temp[0])
        }
      }
    } else {
      //没有默认值
      this.optList = this.options.map(item => ({ ...item }))
      this.multiple && (this.selectedValue = [])
    }
  }
  /**
   * 初始化事件监听器
   */
  setupEventListeners() {
    this.template.addEventListener('click', (e) => {
      e.stopPropagation()
    })

    document.addEventListener('click', () => {
      this.isFocus = false
      this.selectDropdownVisible = false
    })
  }
  /**
  * 校验当前表单项，校验失败会以 danger 形式高亮表单项，同时显示校验失败的提示信息，校验成功则会取消高亮并且清空提示信息
  * @param { string } message 失败的提示信息  
  * @returns {boolean} 校验结果
  */
  @api
  validate(message) {
    let requiredValidateRes = false
    // 必填校验，校验失败显示 message
    requiredValidateRes = this.required
      ? !!(this.multiple
        ? this.selectedValue.length
        : this.selectedValue)
      : true
    if (!requiredValidateRes) {
      this.template.querySelector('.slds-form-element').classList.add('slds-has-error')
      this.errorMessage = message || this.errMessage
    } else {
      this.template.querySelector('.slds-form-element').classList.remove('slds-has-error')
      this.errorMessage = ''
    }
    return requiredValidateRes
  }


  /**
   * 重置当前表单项，如果有默认值会使用默认值进行重置
   */
  @api
  reset() {
    this.setupDefaultValueAndOptList()
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          selectedList: this.multiple ? this.selectedValue : [this.selectedValue],
          selectedIds: this.multiple ? this.selectedValue.map(item => item.id) : [this.selectedValue.id]
        }
      })
    );
    this.inputVal = ''
  }

  /**
   * input handler
   */
  async onInput(e) {
    const newVal = e.currentTarget.value
    this.inputVal = newVal
    this.selectDropdownVisible = true //always display when user input
    this.fetchOptionDebounced(newVal)
  }
  /**
   * 通过 fecth 选项获取远程数据（防抖后）。debounced fecth data function
   * @param {}  
   */
  fetchOptionDebounced = debounce(async (newVal) => {
    if (typeof this.fetch === 'function') {
      const randomId = Math.random().toString(36).slice(2, 10)
      this.randomRequestId = randomId
      const options = await this.fetch(newVal, this.startLoading.bind(this), () => {
        this.randomRequestId === randomId && this.stopLoading()
      })
      if (this.randomRequestId !== randomId) {
        return;
      }
      // console.log(options)
      this.noData = options.length <= 0
      const selectedIdArr = this.multiple ? this.selectedValue.map(item => item.id) : this.selectedValue?.id ? [this.selectedValue?.id] : []
      const formatOptions = options.map(item => ({
        ...item,
        selected: selectedIdArr.includes(item.id)
      }))
      this.optList = formatOptions
      this.updateSelectedValueLabel(formatOptions, this.selectedValue)
    }
  }, this.debounce)
  /**
   * blur handler
   */
  onBlur(e) {
    this.dispatchEvent(
      new CustomEvent('blur')
    );
  }
  /**
   * focus handler
   */
  onFocus(e) {
    if (this.fetch && !this.optList.length) {
      this.fetchOptionDebounced('')
    }
    this.dispatchEvent(
      new CustomEvent('focus')
    );
  }

  /**
   * trigger点击事件。trigger click handler
   */
  triggerClickHandler() {
    this.isFocus = true
    this.keepInputFocus()
    this.toggleSelectedDropdownVisible()
  }

  /**
   * 选项列表选项点击事件。option item click handler
   */
  optionItemClickHandler(e) {
    const id = e.currentTarget.dataset.id
    // singleSelect
    if (!this.multiple) {
      this.inputVal = ''
      this.optList.forEach(item => item.selected = item.id === id ? !item.selected : false)
      this.selectedValue = this.optList.find(item => item.selected)
      this.toggleSelectedDropdownVisible()
      this.dispatchEvent(
        new CustomEvent('change', {
          detail: {
            selectedList: [this.selectedValue],
            selectedIds: [this.selectedValue.id]
          }
        })
      );
      // console.log('singleSelect: ', this.selectedValue)
      return
    }
    // multiple
    for (const item of this.optList) {
      if (item.id === id) {
        const selectedStatus = item.selected
        item.selected = !selectedStatus
        if (selectedStatus) {
          this.selectedValue = this.selectedValue.filter(item => item.id !== id)
        } else {
          this.selectedValue.push(item)
        }
        break;
      }
    }
    this.keepInputFocus()
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          selectedList: this.selectedValue,
          selectedIds: this.selectedValue.map(item => item.id)
        }
      })
    );
    // console.log('multipleSelect: ', this.selectedValue)
  }

  /**
   * clear 按钮点击回调。 Clear icon btn of trigger‘s click handler
   */
  clearBtnClickHandler(e) {
    e.stopPropagation()
    this.selectedValue = []
    // FIXME: 如果有 load 选项的话， 不需要重置
    this.optList.forEach(item => item.selected = false)
    console.log(this.optList)
    this.dispatchEvent(
      new CustomEvent('clear')
    );
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          selectedList: this.selectedValue,
          selectedIds: this.selectedValue.map(item => item.id)
        }
      })
    );
  }

  updateSelectedValueLabel(optionList, selectedValue) {
    const helpMap = new Map()
    selectedValue.forEach((item, index) => {
      helpMap.set(item.id, {
        index,
        item
      })
    })
    optionList.forEach(({ id, label }) => {
      if (helpMap.has(id)) {
        const { index, item } = helpMap.get(id)
        if (label !== item.label) {
          selectedValue.splice(index, 1, ({
            ...item,
            label
          }))
        }
      }
    })
  }

  /**
   * tag点击回调 - 删除当前选中项。 Del icon btn of selected tag's clickHandler 
   */
  tagItemClickHandler(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id
    this.selectedValue = this.selectedValue.filter(item => item.id !== id)
    // FIXME: 如果有 load 选项的话， 不需要重置
    forOfAndIfMatch(this.optList, (item) => item.id === id, (item) => item.selected = false)
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          selectedList: this.selectedValue,
          selectedIds: this.selectedValue.map(item => item.id)
        }
      })
    );
  }

  // ---------------------------------------------------------------- Util Fns(Start)
  // When the showSearch api is enabled, keep input trigger focus
  keepInputFocus() {
    if (this.showSearch) {
      this.template.querySelector('.search-input').focus()
    }
  }

  /**
  * 切换下拉列表的显示隐藏。selectDropdown visible toggle
  */
  toggleSelectedDropdownVisible() {
    this.selectDropdownVisible = !this.selectDropdownVisible
  }

  startLoading() {
    this.loading = true
  }

  stopLoading() {
    this.loading = false
  }
  // ---------------------------------------------------------------- Util Fns(End)

  // ---------------------------------------------------------------- Getter(Start)

  //渲染的选项列表
  get renderOptions() {
    return this.showSearch ? this.optList.filter(option => this.filterOption(this.inputVal, option)) : this.optList
  }
  //是否只读
  get isReadonly() {
    return !this.showSearch
  }

  // 模拟input value 显示的值（模拟 placeholder）
  get getSelectedValueLabel() {
    if (this.multiple) {
      return this.placeholder
    } else {
      return this.selectedValue?.label ? this.selectedValue?.label : this.placeholder
    }
  }

  // 是否显示选中的值的 label（模拟 placeholder）
  get showSelectedValueLabel() {
    /*
        // 多选 
          !this.showSearch && this.multiple && this.selectedValue?.length === 0 
          !this.showSearch && this.multiple && this.pillsPosition === 'bottom'
          this.showSearch && !this.inputVal && this.multiple && this.selectedValue?.length === 0
          this.showSearch && !this.inputVal && this.multiple && this.pillsPosition === 'bottom'
        // 单选 
          !this.showSearch 
          this.showSearch && !this.inputVal
    */
    if (this.multiple) {
      return !this.showSearch && (this.selectedValue?.length === 0 || this.pillsPosition === 'bottom')
        || this.showSearch && !this.inputVal && (this.selectedValue?.length === 0 || this.pillsPosition === 'bottom')
    } else {
      return !this.showSearch || this.showSearch && !this.inputVal
    }
  }

  //是否显示清楚全部按钮
  get showClearBtn() {
    return this.multiple && this.selectedValue?.length
  }

  // 支持多选时是否显示内联药丸。
  get showInlinePills() {
    return this.multiple && this.pillsPosition === 'inline'
  }

  // 支持多选时是否显示底部药丸。
  get showBottomPills() {
    return this.multiple && this.pillsPosition === 'bottom'
  }

  // 是否显示空数据
  get getShowEmptyData() {
    return this.noData
  }

  // classList of the selectDropdown list which decide the placement
  get getSelectDropdownClass() {
    return `select-dropdown slds-dropdown slds-dropdown_length-5 slds-dropdown_fluid placement-${this.placement}`
  }

  get getSearchInputWrapClass() {
    return `search-input-wrap${this.isFocus ? ' focused' : ''}`
  }
  // ---------------------------------------------------------------- Getter(End)




}